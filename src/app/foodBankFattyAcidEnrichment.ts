import type { FoodNutrition } from "./foodBankTypes";
import { EMPTY_FATTY_ACIDS, hasFattyAcidData, normalizeFattyAcids, type FoodFattyAcids } from "./foodBankFattyAcids";
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

export function enrichFoodNutritionFattyAcids(nutrition: FoodNutrition, foodName: string): FoodNutrition {
  const current = normalizeFattyAcids(nutrition.fattyAcids);
  if (hasFattyAcidData(current)) {
    return { ...nutrition, fattyAcids: current };
  }
  const fromLookup = lookupFattyAcidsForFoodName(foodName);
  if (!fromLookup || !hasFattyAcidData(fromLookup)) {
    return { ...nutrition, fattyAcids: current };
  }
  return { ...nutrition, fattyAcids: fromLookup };
}
