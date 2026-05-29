import { compressImageDataUrl, dataUrlToBlob } from "./imageCompress";
import {
  FOOD_BANK_CHANGED_EVENT,
  loadFavoriteFoodIds,
  loadFoodBankItems,
  loadRecentFoodIds,
  notifyFoodBankChanged,
  persistFavoriteFoodIds,
  persistFoodBankItems,
  persistRecentFoodIds,
} from "./foodBankStorage";
import { applyKnownPortionDefaults } from "./foodPortionDefaults";
import { normalizeMicronutrients } from "./foodBankMicronutrients";
import type { FoodItem } from "./foodBankTypes";
import { isSupabaseConfigured, supabaseClient } from "../services/supabaseClient";

const FOOD_IMAGE_BUCKET = "exercise-images";
const FOOD_IMAGE_PREFIX = "food-bank";
const SHARED_FOOD_BANK_TABLE = "shared_food_bank_items";

export type TrainerFoodBankSnapshot = {
  items: FoodItem[];
  favoriteIds: string[];
  recentIds: string[];
  updatedAt: number;
};

export type TrainerFoodBankSaveResult =
  | { ok: true; cloudSynced: boolean; warning?: string }
  | { ok: false; error: string };

function shouldShareFoodItem(item: FoodItem): boolean {
  if (item.isCustom === true) return false;
  if (item.isEdited === true) return false;
  return item.source === "matvaretabell" || item.source === "usda";
}

function parseStringIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((id): id is string => typeof id === "string" && id.trim().length > 0);
}

function isFoodItem(value: unknown): value is FoodItem {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<FoodItem>;
  return typeof row.id === "string" && typeof row.name === "string" && row.nutritionPer100g != null;
}

export function parseFoodItems(value: unknown): FoodItem[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isFoodItem).map((item) =>
    applyKnownPortionDefaults({
      ...item,
      nutritionPer100g: {
        ...item.nutritionPer100g,
        micronutrients: normalizeMicronutrients(item.nutritionPer100g.micronutrients),
      },
    }),
  );
}

export function foodBankShouldUploadLocal(items: FoodItem[], favoriteIds: string[], recentIds: string[]): boolean {
  if (favoriteIds.length > 0 || recentIds.length > 0) return true;
  return items.some(
    (item) => item.isCustom === true || item.isEdited === true || item.source === "matvaretabell" || item.source === "usda",
  );
}

function cacheTrainerFoodBankSnapshot(snapshot: TrainerFoodBankSnapshot): void {
  persistFoodBankItems(snapshot.items);
  persistFavoriteFoodIds(snapshot.favoriteIds);
  persistRecentFoodIds(snapshot.recentIds);
}

function mergeFoodItems(preferred: FoodItem[], fallback: FoodItem[]): FoodItem[] {
  const byId = new Map<string, FoodItem>();
  for (const item of fallback) {
    const id = item.id?.trim();
    if (!id) continue;
    byId.set(id, item);
  }
  for (const item of preferred) {
    const id = item.id?.trim();
    if (!id) continue;
    byId.set(id, item);
  }
  return Array.from(byId.values());
}

async function fetchSharedFoodItemsFromSupabase(): Promise<FoodItem[]> {
  if (!supabaseClient) return [];
  const { data, error } = await supabaseClient.from(SHARED_FOOD_BANK_TABLE).select("id, item, updated_at").order("updated_at", { ascending: false });
  if (error) {
    console.warn("shared_food_bank_items fetch failed:", error.message);
    return [];
  }
  const rows = Array.isArray(data) ? (data as Array<Record<string, unknown>>) : [];
  const items = rows
    .map((row) => row.item)
    .flatMap((value) => parseFoodItems([value]))
    .filter(Boolean);
  return items;
}

async function upsertSharedFoodItemsToSupabase(items: FoodItem[]): Promise<boolean> {
  if (!supabaseClient) return false;
  const shared = items.filter(shouldShareFoodItem);
  if (shared.length === 0) return true;
  const { error } = await supabaseClient.from(SHARED_FOOD_BANK_TABLE).upsert(
    shared.map((item) => ({
      id: item.id,
      item,
      updated_at: new Date().toISOString(),
    })),
    { onConflict: "id" },
  );
  if (error) {
    console.warn("shared_food_bank_items upsert failed:", error.message);
    return false;
  }
  return true;
}

export async function fetchTrainerFoodBankFromSupabase(ownerUserId: string): Promise<TrainerFoodBankSnapshot | null> {
  if (!supabaseClient || !ownerUserId.trim()) return null;
  const { data, error } = await supabaseClient
    .from("trainer_food_bank")
    .select("items, favorite_ids, recent_ids, updated_at")
    .eq("owner_user_id", ownerUserId)
    .maybeSingle();
  if (error) {
    console.warn("trainer_food_bank fetch failed:", error.message);
    return null;
  }
  if (!data) return { items: [], favoriteIds: [], recentIds: [], updatedAt: 0 };
  const updatedAt = new Date(String(data.updated_at ?? "")).getTime();
  return {
    items: parseFoodItems(data.items),
    favoriteIds: parseStringIds(data.favorite_ids),
    recentIds: parseStringIds(data.recent_ids),
    updatedAt: Number.isFinite(updatedAt) ? updatedAt : 0,
  };
}

export async function saveTrainerFoodBankToSupabase(
  ownerUserId: string,
  snapshot: Pick<TrainerFoodBankSnapshot, "items" | "favoriteIds" | "recentIds">,
): Promise<boolean> {
  if (!supabaseClient || !ownerUserId.trim()) return false;
  // Upsert shared items best-effort; ignore failure so per-PT save still works.
  void upsertSharedFoodItemsToSupabase(snapshot.items);
  const { error } = await supabaseClient.from("trainer_food_bank").upsert({
    owner_user_id: ownerUserId,
    items: snapshot.items,
    favorite_ids: parseStringIds(snapshot.favoriteIds),
    recent_ids: parseStringIds(snapshot.recentIds),
    updated_at: new Date().toISOString(),
  });
  if (error) {
    console.warn("trainer_food_bank save failed:", error.message);
    return false;
  }
  return true;
}

async function uploadFoodItemImage(itemId: string, imageUrl?: string): Promise<string | undefined> {
  const trimmed = imageUrl?.trim() ?? "";
  if (!trimmed) return undefined;
  if (!trimmed.startsWith("data:image/")) return trimmed;

  if (!supabaseClient) {
    return compressImageDataUrl(trimmed);
  }

  const compressed = await compressImageDataUrl(trimmed);
  const blob = dataUrlToBlob(compressed);
  if (!blob) return undefined;

  const safeId = itemId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80) || "food";
  const path = `${FOOD_IMAGE_PREFIX}/${safeId}-${Date.now()}.jpg`;
  const { error } = await supabaseClient.storage.from(FOOD_IMAGE_BUCKET).upload(path, blob, {
    cacheControl: "3600",
    upsert: true,
    contentType: "image/jpeg",
  });
  if (error) {
    console.warn("food bank image upload failed:", error.message);
    return compressed;
  }
  const { data } = supabaseClient.storage.from(FOOD_IMAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl || compressed;
}

async function prepareItemsWithRemoteImages(items: FoodItem[]): Promise<FoodItem[]> {
  return Promise.all(
    items.map(async (item) => {
      const imageUrl = await uploadFoodItemImage(item.id, item.imageUrl);
      return imageUrl ? { ...item, imageUrl } : item;
    }),
  );
}

/** Hent matvarebank fra skyen, oppdater lokal cache, varsle lyttere. */
export async function pullTrainerFoodBankFromRemote(ownerUserId: string): Promise<TrainerFoodBankSnapshot | null> {
  if (!isSupabaseConfigured || !ownerUserId.trim()) return null;
  const [sharedItems, snapshot] = await Promise.all([
    fetchSharedFoodItemsFromSupabase(),
    fetchTrainerFoodBankFromSupabase(ownerUserId),
  ]);
  if (!snapshot) return null;
  const merged = { ...snapshot, items: mergeFoodItems(snapshot.items, sharedItems) };
  cacheTrainerFoodBankSnapshot(merged);
  notifyFoodBankChanged();
  return merged;
}

/**
 * Synk ved innlogging: sky er kilde når den har data; ellers push lokale tilpasninger én gang.
 */
export async function syncTrainerFoodBankFromRemote(
  ownerUserId: string,
): Promise<{ ok: boolean; source: "remote" | "local" | "none" }> {
  if (!isSupabaseConfigured || !ownerUserId.trim()) return { ok: false, source: "none" };

  const [sharedItems, remote] = await Promise.all([
    fetchSharedFoodItemsFromSupabase(),
    fetchTrainerFoodBankFromSupabase(ownerUserId),
  ]);
  if (!remote) return { ok: false, source: "none" };

  if (remote.items.length > 0) {
    const previousRaw =
      typeof window !== "undefined" ? window.localStorage.getItem("motus_food_bank_v1") ?? "" : "";
    const merged = { ...remote, items: mergeFoodItems(remote.items, sharedItems) };
    cacheTrainerFoodBankSnapshot(merged);
    if (typeof window !== "undefined") {
      const nextRaw = window.localStorage.getItem("motus_food_bank_v1") ?? "";
      if (nextRaw !== previousRaw) notifyFoodBankChanged();
    }
    return { ok: true, source: "remote" };
  }

  const localItems = mergeFoodItems(loadFoodBankItems(), sharedItems);
  const favoriteIds = loadFavoriteFoodIds();
  const recentIds = loadRecentFoodIds();
  if (!foodBankShouldUploadLocal(localItems, favoriteIds, recentIds)) {
    return { ok: true, source: "none" };
  }

  const prepared = await prepareItemsWithRemoteImages(localItems);
  const uploaded = await saveTrainerFoodBankToSupabase(ownerUserId, {
    items: prepared,
    favoriteIds,
    recentIds,
  });
  if (uploaded) {
    cacheTrainerFoodBankSnapshot({ items: prepared, favoriteIds, recentIds, updatedAt: Date.now() });
  }
  return { ok: uploaded, source: uploaded ? "local" : "none" };
}

let cloudSaveTimer: ReturnType<typeof setTimeout> | null = null;
let pendingCloudSave: { ownerUserId: string; snapshot: TrainerFoodBankSnapshot } | null = null;

export function scheduleTrainerFoodBankCloudSave(ownerUserId: string, snapshot: TrainerFoodBankSnapshot): void {
  if (!ownerUserId.trim() || !isSupabaseConfigured) return;
  pendingCloudSave = { ownerUserId, snapshot };
  if (cloudSaveTimer) clearTimeout(cloudSaveTimer);
  cloudSaveTimer = setTimeout(() => {
    const payload = pendingCloudSave;
    pendingCloudSave = null;
    cloudSaveTimer = null;
    if (!payload) return;
    void persistTrainerFoodBankToCloud(payload.ownerUserId, payload.snapshot);
  }, 700);
}

/** Lagrer lokalt og i Supabase (per PT, på tvers av enheter). */
export async function persistTrainerFoodBankToCloud(
  ownerUserId: string,
  snapshot: TrainerFoodBankSnapshot,
): Promise<TrainerFoodBankSaveResult> {
  if (!ownerUserId.trim()) {
    cacheTrainerFoodBankSnapshot(snapshot);
    return { ok: true, cloudSynced: false };
  }

  cacheTrainerFoodBankSnapshot(snapshot);

  if (!isSupabaseConfigured) {
    return { ok: true, cloudSynced: false };
  }

  const prepared = await prepareItemsWithRemoteImages(snapshot.items);
  void upsertSharedFoodItemsToSupabase(prepared);
  const cloudSynced = await saveTrainerFoodBankToSupabase(ownerUserId, {
    items: prepared,
    favoriteIds: snapshot.favoriteIds,
    recentIds: snapshot.recentIds,
  });

  if (cloudSynced) {
    cacheTrainerFoodBankSnapshot({ ...snapshot, items: prepared });
  }

  if (!cloudSynced) {
    return {
      ok: true,
      cloudSynced: false,
      warning: "Lagret på denne enheten. Kunne ikke synce matvarebanken — kjør trainer_food_bank_schema.sql i Supabase.",
    };
  }

  return { ok: true, cloudSynced: true };
}

/** Skriver lokalt og planlegger debounced sky-lagring. */
export function persistTrainerFoodBankBundle(ownerUserId: string | undefined, snapshot: TrainerFoodBankSnapshot): void {
  cacheTrainerFoodBankSnapshot(snapshot);
  if (ownerUserId?.trim()) {
    scheduleTrainerFoodBankCloudSave(ownerUserId, snapshot);
  }
}
