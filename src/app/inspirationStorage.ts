import { compressImageDataUrl, dataUrlToBlob } from "./imageCompress";
import { isSupabaseConfigured, supabaseClient } from "../services/supabaseClient";

export const INSPIRATION_STORAGE_KEY = "motus.inspiration.items.v2";
export const INSPIRATION_CHANGED_EVENT = "motus:inspiration-changed";
export const INSPIRATION_FEED_ROW_ID = "shared";

const INSPIRATION_IMAGE_BUCKET = "exercise-images";
const MAX_INSPIRATION_STORAGE_BYTES = 4_000_000;

export type InspirationNotificationItem = {
  id: string;
  title: string;
  description: string;
  createdAt: string;
};

export type InspirationSaveResult = { ok: true } | { ok: false; error: string };

export function notifyInspirationItemsChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(INSPIRATION_CHANGED_EVENT));
}

export function saveInspirationItemsToStorage(items: unknown[]): InspirationSaveResult {
  if (typeof window === "undefined") return { ok: true };
  try {
    const serialized = JSON.stringify(items);
    if (serialized.length > MAX_INSPIRATION_STORAGE_BYTES) {
      return {
        ok: false,
        error: "Innholdet er for stort til å lagre. Prøv et mindre bilde eller kortere tekst.",
      };
    }
    window.localStorage.setItem(INSPIRATION_STORAGE_KEY, serialized);
    return { ok: true };
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

export function loadInspirationNotificationItems(): InspirationNotificationItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(INSPIRATION_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
      .map((item) => ({
        id: String(item.id ?? ""),
        title: String(item.title ?? ""),
        description: String(item.description ?? ""),
        createdAt: String(item.createdAt ?? ""),
      }))
      .filter((item) => item.id.length > 0 && item.title.length > 0);
  } catch {
    return [];
  }
}

export async function fetchInspirationItemsFromSupabase(): Promise<unknown[] | null> {
  if (!supabaseClient) return null;
  const { data, error } = await supabaseClient.from("inspiration_feed").select("items").eq("id", INSPIRATION_FEED_ROW_ID).maybeSingle();
  if (error) {
    console.warn("inspiration_feed fetch failed:", error.message);
    return null;
  }
  const items = data?.items;
  return Array.isArray(items) ? items : [];
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

export async function persistInspirationItems<T extends { id: string; imageUrl?: string }>(items: T[]): Promise<InspirationSaveResult> {
  const prepared = await prepareItemsWithRemoteImages(items);

  if (isSupabaseConfigured) {
    const remoteOk = await saveInspirationItemsToSupabase(prepared);
    if (!remoteOk) {
      return {
        ok: false,
        error: "Kunne ikke lagre inspirasjon til skyen. Sjekk at inspiration_feed er opprettet i Supabase.",
      };
    }
  }

  const localResult = saveInspirationItemsToStorage(prepared);
  if (!localResult.ok) return localResult;
  return { ok: true };
}

export async function fetchInspirationItemsForHub<T>(): Promise<T[] | null> {
  if (isSupabaseConfigured) {
    const remote = await fetchInspirationItemsFromSupabase();
    if (remote && remote.length > 0) {
      saveInspirationItemsToStorage(remote);
      return remote as T[];
    }
    if (remote && remote.length === 0) {
      return [] as T[];
    }
  }

  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(INSPIRATION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : null;
  } catch {
    return null;
  }
}
