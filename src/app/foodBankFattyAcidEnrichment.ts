import type { FoodNutrition, FoodSource } from "./foodBankTypes";
import {
  hasFattyAcidData,
  hasStoredFattyAcids,
  normalizeFattyAcids,
  sanitizeStoredFattyAcids,
  type FoodFattyAcids,
} from "./foodBankFattyAcids";
import { normalizeFoodLookupKey } from "./foodBankMicronutrientEnrichment";
import fattyAcidData from "./foodBankFattyAcidsData.json";

type FattyAcidLookupEntry = {
  name: string;
  fattyAcids: FoodFattyAcids;
};

const LOOKUP = (fattyAcidData as { lookup?: Record<string, FattyAcidLookupEntry> }).lookup ?? {};

export function lookupFattyAcidsForFoodName(name: string): FoodFattyAcids | null {
  const entry = LOOKUP[normalizeFoodLookupKey(name)];
  if (!entry?.fattyAcids) return null;
  return normalizeFattyAcids(entry.fattyAcids);
}

export function enrichFoodNutritionFattyAcids(
  nutrition: FoodNutrition,
  foodName: string,
  source?: FoodSource,
): FoodNutrition {
  const stored = sanitizeStoredFattyAcids(nutrition.fattyAcids, {
    keepMeasuredZeros: source === "matvaretabell" || source === "usda",
  });
  if (hasStoredFattyAcids(stored)) {
    return { ...nutrition, fattyAcids: stored as FoodFattyAcids };
  }
  const fromLookup = lookupFattyAcidsForFoodName(foodName);
  if (fromLookup && hasFattyAcidData(fromLookup)) {
    return { ...nutrition, fattyAcids: fromLookup };
  }
  if (nutrition.fattyAcids === undefined) return nutrition;
  const { fattyAcids: _dropped, ...rest } = nutrition;
  return rest;
}
