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

export function saveInspirationItemsToStorage(items: unknown[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(INSPIRATION_STORAGE_KEY, JSON.stringify(items));
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
