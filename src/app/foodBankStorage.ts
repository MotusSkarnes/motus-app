import { enrichFoodItem } from "./foodBankMicronutrientEnrichment";
import { applyKnownPortionDefaults } from "./foodPortionDefaults";
import { normalizeMicronutrients } from "./foodBankMicronutrients";
import { sanitizeStoredFattyAcids } from "./foodBankFattyAcids";
import { dedupeFoodBankItems, remapFoodIdList } from "./foodBankDedup";
import { buildDefaultFoodBankItems, appendMissingSeedFoodItems } from "./foodBankSeed";
import { sanitizeUnitGrams } from "./foodUnitGrams";
import type { FoodItem, FoodNutrition } from "./foodBankTypes";

function normalizeFoodNutrition(nutrition: FoodNutrition, source?: FoodItem["source"]): FoodNutrition {
  const { fattyAcids: _ignored, ...rest } = nutrition;
  const fattyAcids = sanitizeStoredFattyAcids(nutrition.fattyAcids, {
    keepMeasuredZeros: source === "matvaretabell" || source === "usda",
  });
  return {
    ...rest,
    micronutrients: normalizeMicronutrients(nutrition.micronutrients),
    ...(fattyAcids ? { fattyAcids } : {}),
  };
}

function normalizeFoodItem(item: FoodItem): FoodItem {
  const next = enrichFoodItem(
    applyKnownPortionDefaults({
      ...item,
      nutritionPer100g: normalizeFoodNutrition(item.nutritionPer100g, item.source),
    }),
  );
  const unitGrams = sanitizeUnitGrams(next.unitGrams);
  const aliasIds = [...new Set((next.aliasIds ?? []).map((id) => id.trim()).filter(Boolean))];
  return {
    ...(unitGrams ? { ...next, unitGrams } : { ...next, unitGrams: undefined }),
    ...(aliasIds.length ? { aliasIds } : { aliasIds: undefined }),
  };
}

export const FOOD_BANK_STORAGE_KEY = "motus_food_bank_v1";
export const FOOD_BANK_FAVORITES_KEY = "motus_food_bank_favorites_v1";
export const FOOD_BANK_RECENT_KEY = "motus_food_bank_recent_v1";
export const FOOD_BANK_CHANGED_EVENT = "motus-food-bank-changed";

function readJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function notifyFoodBankChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(FOOD_BANK_CHANGED_EVENT));
}

function dedupeAndNormalizeItems(items: FoodItem[]): ReturnType<typeof dedupeFoodBankItems> {
  const normalized = items.map(normalizeFoodItem);
  return dedupeFoodBankItems(normalized);
}

function unitGramsSignature(items: FoodItem[]): string {
  return [...items]
    .map((item) => `${item.id}:${JSON.stringify(item.unitGrams ?? null)}`)
    .sort()
    .join("\n");
}

export function loadFoodBankItems(): FoodItem[] {
  const stored = readJson<FoodItem[]>(FOOD_BANK_STORAGE_KEY);
  if (stored?.length) {
    const withSeeds = appendMissingSeedFoodItems(stored);
    const { items: deduped, idRemap } = dedupeAndNormalizeItems(withSeeds);
    const unitsChanged = unitGramsSignature(stored) !== unitGramsSignature(deduped);
    if (
      deduped.length !== stored.length ||
      withSeeds.length !== stored.length ||
      unitsChanged ||
      Object.keys(idRemap).length > 0
    ) {
      persistFoodBankItems(deduped);
    }
    if (Object.keys(idRemap).length > 0) {
      const previousFavorites = loadFavoriteFoodIds();
      const previousRecent = loadRecentFoodIds();
      const nextFavorites = remapFoodIdList(previousFavorites, idRemap);
      const nextRecent = remapFoodIdList(previousRecent, idRemap);
      if (nextFavorites.join("\n") !== previousFavorites.join("\n")) persistFavoriteFoodIds(nextFavorites);
      if (nextRecent.join("\n") !== previousRecent.join("\n")) persistRecentFoodIds(nextRecent);
    }
    return deduped;
  }
  const seeded = dedupeAndNormalizeItems(buildDefaultFoodBankItems()).items;
  persistFoodBankItems(seeded);
  return seeded;
}

export function persistFoodBankItems(items: FoodItem[]): void {
  writeJson(FOOD_BANK_STORAGE_KEY, items.map(normalizeFoodItem));
  notifyFoodBankChanged();
}

export function loadFavoriteFoodIds(): string[] {
  return readJson<string[]>(FOOD_BANK_FAVORITES_KEY) ?? [];
}

export function persistFavoriteFoodIds(ids: string[]): void {
  writeJson(FOOD_BANK_FAVORITES_KEY, ids);
  notifyFoodBankChanged();
}

export function loadRecentFoodIds(): string[] {
  return readJson<string[]>(FOOD_BANK_RECENT_KEY) ?? [];
}

export function persistRecentFoodIds(ids: string[]): void {
  writeJson(FOOD_BANK_RECENT_KEY, ids);
  notifyFoodBankChanged();
}

export function touchRecentFoodId(foodId: string): string[] {
  const next = [foodId, ...loadRecentFoodIds().filter((id) => id !== foodId)].slice(0, 12);
  persistRecentFoodIds(next);
  return next;
}

export function upsertFoodItem(items: FoodItem[], nextItem: FoodItem): FoodItem[] {
  const index = items.findIndex((item) => item.id === nextItem.id);
  if (index === -1) return [nextItem, ...items];
  const copy = [...items];
  copy[index] = nextItem;
  return copy;
}

export function deleteFoodItem(items: FoodItem[], foodId: string): FoodItem[] {
  return items.filter((item) => item.id !== foodId);
}
