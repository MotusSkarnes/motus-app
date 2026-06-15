import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_INSPIRATION_RECIPES, DEFAULT_RECIPE_SCALING_BY_ID } from "./defaultInspirationRecipes";
import { applyCanonicalRecipeBodies } from "./recipeMacros";
import { isRecipeProteinCategory, type RecipeProteinCategory } from "./recipeProteinCategory";
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
  proteinCategory?: RecipeProteinCategory;
  servings?: number;
};

function pickPreferredRecipeVariant(
  current: InspirationRecipeItem,
  candidate: InspirationRecipeItem,
  options?: { preferCandidate?: boolean },
): InspirationRecipeItem {
  const currentHasImage = Boolean(current.imageUrl?.trim());
  const candidateHasImage = Boolean(candidate.imageUrl?.trim());
  if (options?.preferCandidate) {
    return candidateHasImage ? candidate : currentHasImage ? { ...candidate, imageUrl: current.imageUrl } : candidate;
  }
  if (candidateHasImage && !currentHasImage) return candidate;
  if (currentHasImage && !candidateHasImage) return { ...candidate, imageUrl: current.imageUrl };
  return current;
}

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
  const servings = Number(row.servings);
  return {
    id,
    title: String(row.title ?? "").trim() || "Oppskrift",
    description,
    body: body || description,
    tag: String(row.tag ?? "").trim() || "Oppskrift",
    ...(scalingMode ? { scalingMode } : {}),
    ...(isRecipeProteinCategory(row.proteinCategory) ? { proteinCategory: row.proteinCategory } : {}),
    ...(Number.isFinite(servings) && servings > 0 ? { servings: Math.round(servings) } : {}),
    ...(imageUrl ? { imageUrl } : {}),
  };
}

export function filterRecipeInspirationItems(items: unknown[]): InspirationRecipeItem[] {
  const byId = new Map<string, InspirationRecipeItem>();
  for (const raw of DEFAULT_RECIPE_FEED_ROWS) {
    const normalized = normalizeRecipeItem(raw);
    if (!normalized) continue;
    const existing = byId.get(normalized.id);
    byId.set(normalized.id, existing ? pickPreferredRecipeVariant(existing, normalized) : normalized);
  }
  for (const raw of items) {
    const normalized = normalizeRecipeItem(raw);
    if (!normalized) continue;
    const existing = byId.get(normalized.id);
    byId.set(
      normalized.id,
      existing ? pickPreferredRecipeVariant(existing, normalized, { preferCandidate: true }) : normalized,
    );
  }
  const patched = applyCanonicalRecipeBodies(
    Array.from(byId.values()).map((item) => ({ ...item, category: "recipes" })),
  );
  return patched.sort((a, b) => b.title.localeCompare(a.title, "no"));
}

function recipeItemListsEqual(a: InspirationRecipeItem[], b: InspirationRecipeItem[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    const left = a[i];
    const right = b[i];
    if (!right) return false;
    if (
      left.id !== right.id ||
      left.title !== right.title ||
      left.description !== right.description ||
      left.body !== right.body ||
      left.tag !== right.tag ||
      left.imageUrl !== right.imageUrl ||
      left.scalingMode !== right.scalingMode ||
      left.proteinCategory !== right.proteinCategory ||
      left.servings !== right.servings
    ) {
      return false;
    }
  }
  return true;
}

export function useInspirationRecipeItems(): { items: InspirationRecipeItem[]; loading: boolean; reload: () => void } {
  const [items, setItems] = useState<InspirationRecipeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const hasItemsRef = useRef(false);
  hasItemsRef.current = items.length > 0;

  const reload = useCallback((options?: { silent?: boolean }) => {
    let cancelled = false;
    if (!options?.silent) setLoading(true);
    void (async () => {
      const local = loadInspirationItemsFromLocalStorage<unknown>() ?? [];
      const remote = (await fetchInspirationItemsForHub<unknown>()) ?? local;
      const merged = filterRecipeInspirationItems(remote.length ? remote : local);
      if (!cancelled) {
        setItems((prev) => (recipeItemListsEqual(prev, merged) ? prev : merged));
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
      reload({ silent: hasItemsRef.current });
    };
    window.addEventListener(INSPIRATION_CHANGED_EVENT, onChanged);
    return () => {
      cancel();
      window.removeEventListener(INSPIRATION_CHANGED_EVENT, onChanged);
    };
  }, [reload]);

  return { items, loading, reload };
}
