export const INSPIRATION_STORAGE_KEY = "motus.inspiration.items.v2";
export const INSPIRATION_CHANGED_EVENT = "motus:inspiration-changed";

export type InspirationNotificationItem = {
  id: string;
  title: string;
  description: string;
  createdAt: string;
};

export function notifyInspirationItemsChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(INSPIRATION_CHANGED_EVENT));
}

const MAX_INSPIRATION_STORAGE_BYTES = 4_000_000;

export type InspirationSaveResult = { ok: true } | { ok: false; error: string };

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
