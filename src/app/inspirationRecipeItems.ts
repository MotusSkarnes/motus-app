import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_INSPIRATION_RECIPES, DEFAULT_RECIPE_SCALING_BY_ID } from "./defaultInspirationRecipes";
import { applyCanonicalRecipeBodies, type RecipeIngredientFoodOverrides } from "./recipeMacros";
import { parseRecipeMealSlots, type RecipeMealSlot } from "./recipeMealCategory";
import { isRecipeProteinCategory, type RecipeProteinCategory } from "./recipeProteinCategory";
import {
  fetchInspirationItemsForHub,
  INSPIRATION_CHANGED_EVENT,
  loadInspirationItemsFromLocalStorage,
  loadSuppressedInspirationIds,
  notifyInspirationItemsChanged,
  persistInspirationItems,
  suppressInspirationItemId,
  type InspirationSaveResult,
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
  mealSlots?: RecipeMealSlot[];
  mealSlot?: RecipeMealSlot;
  servings?: number;
  ingredientFoodOverrides?: RecipeIngredientFoodOverrides;
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
  const rawOverrides = row.ingredientFoodOverrides;
  const ingredientFoodOverrides =
    rawOverrides && typeof rawOverrides === "object" && !Array.isArray(rawOverrides)
      ? Object.fromEntries(
          Object.entries(rawOverrides as Record<string, unknown>).filter(
            (entry): entry is [string, string] => typeof entry[0] === "string" && typeof entry[1] === "string" && entry[1].trim().length > 0,
          ),
        )
      : undefined;
  const mealSlots = parseRecipeMealSlots(row.mealSlots, row.mealSlot);
  const rawTag = String(row.tag ?? "").trim();
  return {
    id,
    title: String(row.title ?? "").trim() || "Måltid",
    description,
    body: body || description,
    tag: !rawTag || rawTag === "Oppskrift" ? "Måltid" : rawTag,
    ...(scalingMode ? { scalingMode } : {}),
    ...(isRecipeProteinCategory(row.proteinCategory) ? { proteinCategory: row.proteinCategory } : {}),
    ...(mealSlots.length ? { mealSlots, mealSlot: mealSlots[0] } : {}),
    ...(Number.isFinite(servings) && servings > 0 ? { servings: Math.round(servings) } : {}),
    ...(ingredientFoodOverrides && Object.keys(ingredientFoodOverrides).length
      ? { ingredientFoodOverrides }
      : {}),
    ...(imageUrl ? { imageUrl } : {}),
  };
}

export function filterRecipeInspirationItems(
  items: unknown[],
  options?: { suppressedIds?: Iterable<string> },
): InspirationRecipeItem[] {
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
  const suppressed = new Set(
    options?.suppressedIds ? Array.from(options.suppressedIds) : Array.from(loadSuppressedInspirationIds()),
  );
  const patched = applyCanonicalRecipeBodies(
    Array.from(byId.values()).map((item) => ({ ...item, category: "recipes" })),
  );
  return patched.filter((item) => !suppressed.has(item.id)).sort((a, b) => b.title.localeCompare(a.title, "no"));
}

export async function deleteInspirationRecipe(
  recipeId: string,
  existingItems: unknown[] = [],
): Promise<InspirationSaveResult> {
  const trimmed = recipeId.trim();
  if (!trimmed) return { ok: false, error: "Mangler måltid." };

  const latestItems =
    (await fetchInspirationItemsForHub<unknown>()) ??
    loadInspirationItemsFromLocalStorage<unknown>() ??
    existingItems;
  const nextFeed = (latestItems as Array<{ id: string }>).filter((item) => item.id !== trimmed);
  suppressInspirationItemId(trimmed);
  const result = await persistInspirationItems(nextFeed);
  if (result.ok) notifyInspirationItemsChanged();
  return result;
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
      JSON.stringify(left.mealSlots ?? []) !== JSON.stringify(right.mealSlots ?? []) ||
      left.mealSlot !== right.mealSlot ||
      left.servings !== right.servings ||
      JSON.stringify(left.ingredientFoodOverrides ?? {}) !== JSON.stringify(right.ingredientFoodOverrides ?? {})
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
