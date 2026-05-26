import { compressImageDataUrl, dataUrlToBlob } from "./imageCompress";
import { isSupabaseConfigured, supabaseClient } from "../services/supabaseClient";

export const INSPIRATION_STORAGE_KEY = "motus.inspiration.items.v2";
export const INSPIRATION_CHANGED_EVENT = "motus:inspiration-changed";
export const INSPIRATION_FEED_ROW_ID = "shared";
export const INSPIRATION_HERO_ROW_ID = "hero";
export const INSPIRATION_SUPPRESSED_IDS_KEY = "motus.inspiration.suppressedIds.v1";
export const INSPIRATION_HERO_STORAGE_KEY = "motus.inspiration.hero.v1";
export const INSPIRATION_HERO_CHANGED_EVENT = "motus:inspiration-hero-changed";

export type InspirationHeroConfig = {
  imageUrl: string;
  title?: string;
  subtitle?: string;
  badge?: string;
  ctaLabel?: string;
  updatedAt?: number;
};

const HERO_IMAGE_PREFIX = "inspiration-hero";

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

export type InspirationFeedSnapshot = {
  items: unknown[];
  suppressedItemIds: string[];
  updatedAt: number;
};

export type InspirationSaveResult =
  | { ok: true; cloudSynced: boolean; warning?: string }
  | { ok: false; error: string };

export function notifyInspirationItemsChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(INSPIRATION_CHANGED_EVENT));
}

function parseSuppressedItemIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
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
    return new Set(parseSuppressedItemIds(parsed));
  } catch {
    return new Set();
  }
}

export function saveSuppressedInspirationIds(ids: string[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(INSPIRATION_SUPPRESSED_IDS_KEY, JSON.stringify(parseSuppressedItemIds(ids)));
}

export function suppressInspirationItemId(id: string): void {
  const trimmed = id.trim();
  if (!trimmed) return;
  const next = loadSuppressedInspirationIds();
  next.add(trimmed);
  saveSuppressedInspirationIds(Array.from(next));
}

export function filterSuppressedInspirationItems<T extends { id: string }>(items: T[]): T[] {
  const suppressed = loadSuppressedInspirationIds();
  if (!suppressed.size) return items;
  return items.filter((item) => !suppressed.has(item.id));
}

export function cacheInspirationFeedSnapshot(snapshot: InspirationFeedSnapshot): void {
  if (typeof window === "undefined") return;
  const localSuppressed = loadSuppressedInspirationIds();
  const mergedSuppressed = Array.from(
    new Set([...parseSuppressedItemIds(snapshot.suppressedItemIds), ...localSuppressed]),
  );
  saveSuppressedInspirationIds(mergedSuppressed);
  saveInspirationItemsToStorage(filterSuppressedInspirationItems(snapshot.items as Array<{ id: string }>), {
    trackLocalWrite: false,
  });
}

/** Re-add built-in defaults unless the user/PT has explicitly deleted them. */
export function mergeDefaultInspirationItems<T extends { id: string }>(items: T[], defaultItems: T[]): T[] {
  const suppressed = loadSuppressedInspirationIds();
  const existingIds = new Set(items.map((item) => item.id));
  const missing = defaultItems.filter((item) => !existingIds.has(item.id) && !suppressed.has(item.id));
  if (!missing.length) return items;
  return [...items, ...missing];
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
    void options;
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
    return mapRawToInspirationNotificationItems(filterSuppressedInspirationItems(parsed as Array<{ id: string }>));
  } catch {
    return [];
  }
}

export async function fetchInspirationFeedFromSupabase(): Promise<InspirationFeedSnapshot | null> {
  if (!supabaseClient) return null;
  const { data, error } = await supabaseClient
    .from("inspiration_feed")
    .select("items, suppressed_item_ids, updated_at")
    .eq("id", INSPIRATION_FEED_ROW_ID)
    .maybeSingle();
  if (error) {
    console.warn("inspiration_feed fetch failed:", error.message);
    return null;
  }
  if (!data) return { items: [], suppressedItemIds: [], updatedAt: 0 };
  const items = data.items;
  const updatedAt = new Date(String(data.updated_at ?? "")).getTime();
  return {
    items: Array.isArray(items) ? items : [],
    suppressedItemIds: parseSuppressedItemIds(data.suppressed_item_ids),
    updatedAt: Number.isFinite(updatedAt) ? updatedAt : 0,
  };
}

export async function fetchInspirationItemsFromSupabase(): Promise<unknown[] | null> {
  const feed = await fetchInspirationFeedFromSupabase();
  return feed?.items ?? null;
}

export async function saveInspirationFeedToSupabase(snapshot: {
  items: unknown[];
  suppressedItemIds: string[];
}): Promise<boolean> {
  if (!supabaseClient) return false;
  const { error } = await supabaseClient.from("inspiration_feed").upsert({
    id: INSPIRATION_FEED_ROW_ID,
    items: snapshot.items,
    suppressed_item_ids: parseSuppressedItemIds(snapshot.suppressedItemIds),
    updated_at: new Date().toISOString(),
  });
  if (error) {
    console.warn("inspiration_feed save failed:", error.message);
    return false;
  }
  return true;
}

/** @deprecated Use saveInspirationFeedToSupabase */
export async function saveInspirationItemsToSupabase(items: unknown[]): Promise<boolean> {
  return saveInspirationFeedToSupabase({ items, suppressedItemIds: Array.from(loadSuppressedInspirationIds()) });
}

/** Hent feed fra Supabase, oppdater lokal cache og returner snapshot. */
export async function pullInspirationFeedFromRemote(): Promise<InspirationFeedSnapshot | null> {
  if (!isSupabaseConfigured) return null;
  const snapshot = await fetchInspirationFeedFromSupabase();
  if (!snapshot) return null;
  const localSuppressed = loadSuppressedInspirationIds();
  const mergedSuppressed = Array.from(
    new Set([...snapshot.suppressedItemIds, ...localSuppressed]),
  );
  const merged: InspirationFeedSnapshot = { ...snapshot, suppressedItemIds: mergedSuppressed };
  cacheInspirationFeedSnapshot(merged);
  return merged;
}

/** Hent delt inspo-feed fra Supabase, oppdater lokal cache og varsle lyttere (medlemmer). */
export async function refreshInspirationNotificationItemsFromRemote(): Promise<InspirationNotificationItem[]> {
  if (typeof window === "undefined") return [];
  if (!isSupabaseConfigured) return loadInspirationNotificationItems();

  const previousRaw = window.localStorage.getItem(INSPIRATION_STORAGE_KEY) ?? "";
  const snapshot = await pullInspirationFeedFromRemote();
  if (!snapshot) {
    return loadInspirationNotificationItems();
  }

  const nextRaw = window.localStorage.getItem(INSPIRATION_STORAGE_KEY) ?? "";
  if (nextRaw !== previousRaw) {
    notifyInspirationItemsChanged();
  }
  return mapRawToInspirationNotificationItems(filterSuppressedInspirationItems(snapshot.items as Array<{ id: string }>));
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

/** Lagrer lokalt og i Supabase (kilde på tvers av enheter). */
export async function persistInspirationItems<T extends { id: string; imageUrl?: string }>(items: T[]): Promise<InspirationSaveResult> {
  const prepared = await prepareItemsWithRemoteImages(items);
  const suppressedItemIds = Array.from(loadSuppressedInspirationIds());

  const localResult = saveInspirationItemsToStorage(prepared);
  if (!localResult.ok) return localResult;

  if (!isSupabaseConfigured) {
    return { ok: true, cloudSynced: false };
  }

  const cloudSynced = await saveInspirationFeedToSupabase({ items: prepared, suppressedItemIds });
  if (!cloudSynced) {
    return {
      ok: true,
      cloudSynced: false,
      warning: "Lagret på denne enheten. Kunne ikke synce til skyen — kjør inspiration_feed_suppressed_ids.sql i Supabase.",
    };
  }

  cacheInspirationFeedSnapshot({ items: prepared, suppressedItemIds, updatedAt: Date.now() });
  return { ok: true, cloudSynced: true };
}

/**
 * Henter inspo fra databasen (kilde), med lokal cache som offline-reserve.
 */
export async function fetchInspirationItemsForHub<T>(): Promise<T[] | null> {
  if (!isSupabaseConfigured) {
    return loadInspirationItemsFromLocalStorage<T>();
  }

  const snapshot = await pullInspirationFeedFromRemote();
  if (snapshot) {
    return filterSuppressedInspirationItems(snapshot.items as Array<T & { id: string }>) as T[];
  }

  return loadInspirationItemsFromLocalStorage<T>();
}

/** PT: sky tom, men lokalt innhold finnes — fyll skyen én gang. */
export async function syncLocalInspirationToSupabaseIfNeeded<T extends { id: string; imageUrl?: string }>(
  localItems: T[] | null,
): Promise<boolean> {
  if (!isSupabaseConfigured || !localItems?.length) return false;
  const remote = await fetchInspirationFeedFromSupabase();
  if (remote === null || remote.items.length > 0) return false;
  return saveInspirationFeedToSupabase({
    items: localItems,
    suppressedItemIds: Array.from(loadSuppressedInspirationIds()),
  });
}

/* ============================================================================
 * Hero-bilde for Utforsk — PT-redigerbart, delt på tvers av enheter.
 * Lagres som egen rad i `inspiration_feed` (id = "hero"), så ingen skjema-endring.
 * Hero-konfig serialiseres som et enkelt JSON-objekt i `items`-feltet.
 * ========================================================================== */

export function notifyInspirationHeroChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(INSPIRATION_HERO_CHANGED_EVENT));
}

function parseHeroConfig(value: unknown): InspirationHeroConfig | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const imageUrl = typeof raw.imageUrl === "string" ? raw.imageUrl.trim() : "";
  if (!imageUrl) return null;
  const next: InspirationHeroConfig = { imageUrl };
  if (typeof raw.title === "string" && raw.title.trim()) next.title = raw.title.trim();
  if (typeof raw.subtitle === "string" && raw.subtitle.trim()) next.subtitle = raw.subtitle.trim();
  if (typeof raw.badge === "string" && raw.badge.trim()) next.badge = raw.badge.trim();
  if (typeof raw.ctaLabel === "string" && raw.ctaLabel.trim()) next.ctaLabel = raw.ctaLabel.trim();
  if (typeof raw.updatedAt === "number") next.updatedAt = raw.updatedAt;
  return next;
}

export function loadInspirationHeroFromLocalStorage(): InspirationHeroConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(INSPIRATION_HERO_STORAGE_KEY);
    if (!raw) return null;
    return parseHeroConfig(JSON.parse(raw));
  } catch {
    return null;
  }
}

function saveHeroToLocalStorage(config: InspirationHeroConfig): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(INSPIRATION_HERO_STORAGE_KEY, JSON.stringify(config));
  } catch {
    /* quota / private mode — non-fatal */
  }
}

async function uploadInspirationHeroImage(dataUrl: string): Promise<string> {
  const compressed = await compressImageDataUrl(dataUrl);
  if (!supabaseClient) return compressed;
  const blob = dataUrlToBlob(compressed);
  if (!blob) return compressed;
  const path = `${HERO_IMAGE_PREFIX}/hero-${Date.now()}.jpg`;
  const { error } = await supabaseClient.storage.from(INSPIRATION_IMAGE_BUCKET).upload(path, blob, {
    cacheControl: "3600",
    upsert: true,
    contentType: "image/jpeg",
  });
  if (error) {
    console.warn("inspiration hero upload failed:", error.message);
    return compressed;
  }
  const { data } = supabaseClient.storage.from(INSPIRATION_IMAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl || compressed;
}

async function fetchInspirationHeroFromSupabase(): Promise<InspirationHeroConfig | null> {
  if (!supabaseClient) return null;
  const { data, error } = await supabaseClient
    .from("inspiration_feed")
    .select("items, updated_at")
    .eq("id", INSPIRATION_HERO_ROW_ID)
    .maybeSingle();
  if (error) {
    console.warn("inspiration hero fetch failed:", error.message);
    return null;
  }
  if (!data) return null;
  const items = data.items;
  const payload = Array.isArray(items) ? items[0] : items;
  return parseHeroConfig(payload);
}

async function saveInspirationHeroToSupabase(config: InspirationHeroConfig): Promise<boolean> {
  if (!supabaseClient) return false;
  const { error } = await supabaseClient.from("inspiration_feed").upsert({
    id: INSPIRATION_HERO_ROW_ID,
    items: [config],
    suppressed_item_ids: [],
    updated_at: new Date().toISOString(),
  });
  if (error) {
    console.warn("inspiration hero save failed:", error.message);
    return false;
  }
  return true;
}

/** Hent hero fra skyen, oppdater lokal cache, varsle lyttere. Returnerer konfig hvis funnet. */
export async function pullInspirationHeroFromRemote(): Promise<InspirationHeroConfig | null> {
  if (!isSupabaseConfigured) return loadInspirationHeroFromLocalStorage();
  const remote = await fetchInspirationHeroFromSupabase();
  if (!remote) return loadInspirationHeroFromLocalStorage();
  const previous = loadInspirationHeroFromLocalStorage();
  saveHeroToLocalStorage(remote);
  if (!previous || previous.imageUrl !== remote.imageUrl) {
    notifyInspirationHeroChanged();
  }
  return remote;
}

export type InspirationHeroSaveResult =
  | { ok: true; cloudSynced: boolean; warning?: string; config: InspirationHeroConfig }
  | { ok: false; error: string };

/** PT lagrer ny hero-konfig: data-URL lastes opp til Storage, deretter persistens i Supabase + lokal cache. */
export async function persistInspirationHero(input: InspirationHeroConfig): Promise<InspirationHeroSaveResult> {
  const trimmedImage = input.imageUrl.trim();
  if (!trimmedImage) return { ok: false, error: "Mangler bildelenke." };
  let imageUrl = trimmedImage;
  if (trimmedImage.startsWith("data:image/")) {
    try {
      imageUrl = await uploadInspirationHeroImage(trimmedImage);
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Kunne ikke prosessere bilde." };
    }
  }
  const next: InspirationHeroConfig = { ...input, imageUrl, updatedAt: Date.now() };
  saveHeroToLocalStorage(next);
  notifyInspirationHeroChanged();
  if (!isSupabaseConfigured) return { ok: true, cloudSynced: false, config: next };
  const cloudSynced = await saveInspirationHeroToSupabase(next);
  if (!cloudSynced) {
    return {
      ok: true,
      cloudSynced: false,
      warning: "Lagret lokalt. Kunne ikke synce til skyen — sjekk inspiration_feed-tilgangen.",
      config: next,
    };
  }
  return { ok: true, cloudSynced: true, config: next };
}
