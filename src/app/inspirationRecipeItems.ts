import { useCallback, useEffect, useState } from "react";
import {
  fetchInspirationItemsForHub,
  INSPIRATION_CHANGED_EVENT,
  loadInspirationItemsFromLocalStorage,
} from "./inspirationStorage";

export type InspirationRecipeItem = {
  id: string;
  title: string;
  description: string;
  body: string;
  tag: string;
  imageUrl?: string;
};

function normalizeRecipeItem(raw: unknown): InspirationRecipeItem | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  if (String(row.category ?? "").trim().toLowerCase() !== "recipes") return null;
  const id = String(row.id ?? "").trim();
  if (!id) return null;
  const imageUrl = String(row.imageUrl ?? "").trim();
  return {
    id,
    title: String(row.title ?? "").trim() || "Oppskrift",
    description: String(row.description ?? "").trim(),
    body: String(row.body ?? ""),
    tag: String(row.tag ?? "").trim() || "Oppskrift",
    ...(imageUrl ? { imageUrl } : {}),
  };
}

export function filterRecipeInspirationItems(items: unknown[]): InspirationRecipeItem[] {
  const byId = new Map<string, InspirationRecipeItem>();
  for (const raw of items) {
    const normalized = normalizeRecipeItem(raw);
    if (!normalized) continue;
    if (!byId.has(normalized.id)) byId.set(normalized.id, normalized);
  }
  return Array.from(byId.values()).sort((a, b) => b.title.localeCompare(a.title, "no"));
}

export function useInspirationRecipeItems(): { items: InspirationRecipeItem[]; loading: boolean; reload: () => void } {
  const [items, setItems] = useState<InspirationRecipeItem[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const local = loadInspirationItemsFromLocalStorage<unknown>() ?? [];
      const remote = (await fetchInspirationItemsForHub<unknown>()) ?? local;
      const merged = filterRecipeInspirationItems(remote.length ? remote : local);
      if (!cancelled) {
        setItems(merged);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const cancel = reload();
    const onChanged = () => {
      cancel();
      reload();
    };
    window.addEventListener(INSPIRATION_CHANGED_EVENT, onChanged);
    return () => {
      cancel();
      window.removeEventListener(INSPIRATION_CHANGED_EVENT, onChanged);
    };
  }, [reload]);

  return { items, loading, reload };
}
