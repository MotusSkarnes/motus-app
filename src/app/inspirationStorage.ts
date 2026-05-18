import { compressImageDataUrl, dataUrlToBlob } from "./imageCompress";
import { isSupabaseConfigured, supabaseClient } from "../services/supabaseClient";

export const INSPIRATION_STORAGE_KEY = "motus.inspiration.items.v2";
export const INSPIRATION_CHANGED_EVENT = "motus:inspiration-changed";
export const INSPIRATION_FEED_ROW_ID = "shared";
export const INSPIRATION_SUPPRESSED_IDS_KEY = "motus.inspiration.suppressedIds.v1";
const INSPIRATION_LOCAL_WRITE_AT_KEY = "motus.inspiration.lastLocalWriteAt";

const INSPIRATION_IMAGE_BUCKET = "exercise-images";
const INSPIRATION_IMAGE_PREFIX = "inspiration";
const MAX_INSPIRATION_STORAGE_BYTES = 4_000_000;

export type InspirationNotificationItem = {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  category?: string;
  kind?: string;
};

export type InspirationSaveResult =
  | { ok: true; cloudSynced: boolean; warning?: string }
  | { ok: false; error: string };

export function notifyInspirationItemsChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(INSPIRATION_CHANGED_EVENT));
}

export function loadInspirationItemsFromLocalStorage<T>(): T[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(INSPIRATION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) && parsed.length > 0 ? (parsed as T[]) : null;
  } catch {
    return null;
  }
}

export function loadSuppressedInspirationIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(INSPIRATION_SUPPRESSED_IDS_KEY);
    const parsed = JSON.parse(raw ?? "[]") as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0));
  } catch {
    return new Set();
  }
}

export function suppressInspirationItemId(id: string): void {
  if (typeof window === "undefined") return;
  const trimmed = id.trim();
  if (!trimmed) return;
  const next = loadSuppressedInspirationIds();
  next.add(trimmed);
  window.localStorage.setItem(INSPIRATION_SUPPRESSED_IDS_KEY, JSON.stringify(Array.from(next)));
}

export function filterSuppressedInspirationItems<T extends { id: string }>(items: T[]): T[] {
  const suppressed = loadSuppressedInspirationIds();
  if (!suppressed.size) return items;
  return items.filter((item) => !suppressed.has(item.id));
}

export function saveInspirationItemsToStorage(
  items: unknown[],
  options?: { trackLocalWrite?: boolean },
): InspirationSaveResult {
  if (typeof window === "undefined") return { ok: true, cloudSynced: false };
  try {
    const serialized = JSON.stringify(items);
    if (serialized.length > MAX_INSPIRATION_STORAGE_BYTES) {
      return {
        ok: false,
        error: "Innholdet er for stort til å lagre. Prøv et mindre bilde eller kortere tekst.",
      };
    }
    window.localStorage.setItem(INSPIRATION_STORAGE_KEY, serialized);
    if (options?.trackLocalWrite !== false) {
      window.localStorage.setItem(INSPIRATION_LOCAL_WRITE_AT_KEY, String(Date.now()));
    }
    return { ok: true, cloudSynced: false };
  } catch (error) {
    const isQuota =
      (error instanceof DOMException && (error.name === "QuotaExceededError" || error.code === 22)) ||
      (error instanceof Error && /quota/i.test(error.message));
    return {
      ok: false,
      error: isQuota
        ? "Kunne ikke lagre bildet (for stor fil). Prøv et mindre bilde."
        : "Kunne ikke lagre inspirasjon. Prøv igjen.",
    };
  }
}

export function mapRawToInspirationNotificationItems(items: unknown[]): InspirationNotificationItem[] {
  return items
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => ({
      id: String(item.id ?? ""),
      title: String(item.title ?? ""),
      description: String(item.description ?? ""),
      createdAt: String(item.createdAt ?? ""),
      category: String(item.category ?? ""),
      kind: String(item.kind ?? "article"),
    }))
    .filter((item) => item.id.length > 0 && item.title.length > 0);
}

export function loadInspirationNotificationItems(): InspirationNotificationItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(INSPIRATION_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return mapRawToInspirationNotificationItems(parsed);
  } catch {
    return [];
  }
}

/** Hent delt inspo-feed fra Supabase, oppdater lokal cache og varsle lyttere (medlemmer). */
export async function refreshInspirationNotificationItemsFromRemote(): Promise<InspirationNotificationItem[]> {
  if (typeof window === "undefined") return [];
  if (!isSupabaseConfigured) return loadInspirationNotificationItems();

  const remote = await fetchInspirationItemsFromSupabase();
  if (remote === null || remote.length === 0) {
    return loadInspirationNotificationItems();
  }

  const previousRaw = window.localStorage.getItem(INSPIRATION_STORAGE_KEY) ?? "";
  saveInspirationItemsToStorage(remote);
  const nextRaw = window.localStorage.getItem(INSPIRATION_STORAGE_KEY) ?? "";
  if (nextRaw !== previousRaw) {
    notifyInspirationItemsChanged();
  }
  return mapRawToInspirationNotificationItems(remote);
}

export async function fetchInspirationFeedFromSupabase(): Promise<{ items: unknown[]; updatedAt: number } | null> {
  if (!supabaseClient) return null;
  const { data, error } = await supabaseClient
    .from("inspiration_feed")
    .select("items, updated_at")
    .eq("id", INSPIRATION_FEED_ROW_ID)
    .maybeSingle();
  if (error) {
    console.warn("inspiration_feed fetch failed:", error.message);
    return null;
  }
  if (!data) return { items: [], updatedAt: 0 };
  const items = data.items;
  const updatedAt = new Date(String(data.updated_at ?? "")).getTime();
  return {
    items: Array.isArray(items) ? items : [],
    updatedAt: Number.isFinite(updatedAt) ? updatedAt : 0,
  };
}

export async function fetchInspirationItemsFromSupabase(): Promise<unknown[] | null> {
  const feed = await fetchInspirationFeedFromSupabase();
  return feed?.items ?? null;
}

export async function saveInspirationItemsToSupabase(items: unknown[]): Promise<boolean> {
  if (!supabaseClient) return false;
  const { error } = await supabaseClient.from("inspiration_feed").upsert({
    id: INSPIRATION_FEED_ROW_ID,
    items,
    updated_at: new Date().toISOString(),
  });
  if (error) {
    console.warn("inspiration_feed save failed:", error.message);
    return false;
  }
  return true;
}

async function uploadInspirationItemImage(itemId: string, imageUrl?: string): Promise<string | undefined> {
  const trimmed = imageUrl?.trim() ?? "";
  if (!trimmed) return undefined;
  if (!trimmed.startsWith("data:image/")) return trimmed;

  if (!supabaseClient) {
    return compressImageDataUrl(trimmed);
  }

  const compressed = await compressImageDataUrl(trimmed);
  const blob = dataUrlToBlob(compressed);
  if (!blob) return undefined;

  const safeId = itemId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80) || "item";
  const path = `${INSPIRATION_IMAGE_PREFIX}/${safeId}-${Date.now()}.jpg`;
  const { error } = await supabaseClient.storage.from(INSPIRATION_IMAGE_BUCKET).upload(path, blob, {
    cacheControl: "3600",
    upsert: true,
    contentType: "image/jpeg",
  });
  if (error) {
    console.warn("inspiration image upload failed:", error.message);
    return compressed;
  }
  const { data } = supabaseClient.storage.from(INSPIRATION_IMAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl || compressed;
}

async function prepareItemsWithRemoteImages<T extends { id: string; imageUrl?: string }>(items: T[]): Promise<T[]> {
  return Promise.all(
    items.map(async (item) => {
      const imageUrl = await uploadInspirationItemImage(item.id, item.imageUrl);
      return { ...item, imageUrl };
    }),
  );
}

/** Lagrer alltid lokalt. Prøver sky hvis konfigurert, men feiler ikke hele lagringen ved sky-feil. */
export async function persistInspirationItems<T extends { id: string; imageUrl?: string }>(items: T[]): Promise<InspirationSaveResult> {
  const prepared = await prepareItemsWithRemoteImages(items);

  const localResult = saveInspirationItemsToStorage(prepared);
  if (!localResult.ok) return localResult;

  if (!isSupabaseConfigured) {
    return { ok: true, cloudSynced: false };
  }

  const cloudSynced = await saveInspirationItemsToSupabase(prepared);
  if (!cloudSynced) {
    return {
      ok: true,
      cloudSynced: false,
      warning: "Lagret på denne enheten. Kunne ikke synce til skyen — kjør inspiration_feed_schema.sql i Supabase for deling med medlemmer.",
    };
  }

  return { ok: true, cloudSynced: true };
}

/**
 * Henter inspo: sky først hvis den har innhold, ellers lokalt cache.
 * Tom sky-feed overskriver ikke lokale data.
 */
export async function fetchInspirationItemsForHub<T>(): Promise<T[] | null> {
  const local = loadInspirationItemsFromLocalStorage<T>();
  const localWriteAt = Number(
    typeof window !== "undefined" ? window.localStorage.getItem(INSPIRATION_LOCAL_WRITE_AT_KEY) ?? "0" : "0",
  );

  if (!isSupabaseConfigured) {
    return local;
  }

  const feed = await fetchInspirationFeedFromSupabase();
  if (feed === null) {
    return local;
  }

  if (local && localWriteAt > feed.updatedAt) {
    return local;
  }

  if (feed.items.length > 0) {
    saveInspirationItemsToStorage(feed.items, { trackLocalWrite: false });
    return feed.items as T[];
  }

  return local;
}

/** PT: sky tom, men lokalt innhold finnes — fyll skyen én gang. */
export async function syncLocalInspirationToSupabaseIfNeeded<T extends { id: string; imageUrl?: string }>(
  localItems: T[] | null,
): Promise<boolean> {
  if (!isSupabaseConfigured || !localItems?.length) return false;
  const remote = await fetchInspirationItemsFromSupabase();
  if (remote === null || remote.length > 0) return false;
  return saveInspirationItemsToSupabase(localItems);
}
