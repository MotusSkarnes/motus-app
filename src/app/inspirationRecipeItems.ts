import { useCallback, useEffect, useState } from "react";
import { DEFAULT_INSPIRATION_RECIPES, DEFAULT_RECIPE_SCALING_BY_ID } from "./defaultInspirationRecipes";
import type { RecipeScalingMode } from "./recipeMealScaling";
import { applyCanonicalRecipeBodies } from "./recipeMacros";
import {
  fetchInspirationItemsForHub,
  INSPIRATION_CHANGED_EVENT,
  loadInspirationItemsFromLocalStorage,
} from "./inspirationStorage";

const DEFAULT_RECIPE_FEED_ROWS: unknown[] = DEFAULT_INSPIRATION_RECIPES.map((recipe) => ({
  ...recipe,
  category: "recipes",
  kind: "article",
  author: "Motus",
}));

export type InspirationRecipeItem = {
  id: string;
  title: string;
  description: string;
  body: string;
  tag: string;
  imageUrl?: string;
  scalingMode?: "flexible" | "fixed";
};

function normalizeRecipeItem(raw: unknown): InspirationRecipeItem | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const category = String(row.category ?? "").trim().toLowerCase();
  if (category !== "recipes" && category !== "oppskrift") return null;
  const id = String(row.id ?? "").trim();
  if (!id) return null;
  const imageUrl = String(row.imageUrl ?? "").trim();
  const body = String(row.body ?? row.content ?? "").trim();
  const description = String(row.description ?? "").trim();
  const scalingMode =
    (row.scalingMode === "flexible" || row.scalingMode === "fixed" ? row.scalingMode : undefined) ??
    DEFAULT_RECIPE_SCALING_BY_ID.get(id);
  return {
    id,
    title: String(row.title ?? "").trim() || "Oppskrift",
    description,
    body: body || description,
    tag: String(row.tag ?? "").trim() || "Oppskrift",
    ...(scalingMode ? { scalingMode } : {}),
    ...(imageUrl ? { imageUrl } : {}),
  };
}

export function filterRecipeInspirationItems(items: unknown[]): InspirationRecipeItem[] {
  const byId = new Map<string, InspirationRecipeItem>();
  for (const raw of DEFAULT_RECIPE_FEED_ROWS) {
    const normalized = normalizeRecipeItem(raw);
    if (normalized) byId.set(normalized.id, normalized);
  }
  for (const raw of items) {
    const normalized = normalizeRecipeItem(raw);
    if (normalized) byId.set(normalized.id, normalized);
  }
  const patched = applyCanonicalRecipeBodies(
    Array.from(byId.values()).map((item) => ({ ...item, category: "recipes" })),
  );
  return patched.sort((a, b) => b.title.localeCompare(a.title, "no"));
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
