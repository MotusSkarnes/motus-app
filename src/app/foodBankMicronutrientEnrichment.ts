import type { FoodItem, FoodNutrition } from "./foodBankTypes";
import {
  hasMicronutrientData,
  normalizeMicronutrients,
  type FoodMicronutrients,
} from "./foodBankMicronutrients";
import micronutrientData from "./foodBankMicronutrientsData.json";

type MicronutrientLookupEntry = {
  name: string;
  micros: FoodMicronutrients;
};

const LOOKUP = micronutrientData.lookup as Record<string, MicronutrientLookupEntry>;

export function normalizeFoodLookupKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9æøå]+/g, " ");
}

export function lookupMicronutrientsForFoodName(name: string): FoodMicronutrients | null {
  const key = normalizeFoodLookupKey(name);
  const entry = LOOKUP[key];
  if (!entry?.micros) return null;
  return normalizeMicronutrients(entry.micros);
}

export function enrichFoodNutrition(nutrition: FoodNutrition, foodName: string): FoodNutrition {
  const normalized = normalizeMicronutrients(nutrition.micronutrients);
  if (hasMicronutrientData(normalized)) {
    return { ...nutrition, micronutrients: normalized };
  }
  const fromLookup = lookupMicronutrientsForFoodName(foodName);
  if (!fromLookup || !hasMicronutrientData(fromLookup)) {
    return { ...nutrition, micronutrients: normalized };
  }
  return { ...nutrition, micronutrients: fromLookup };
}

export function enrichFoodItem(item: FoodItem): FoodItem {
  return {
    ...item,
    nutritionPer100g: enrichFoodNutrition(item.nutritionPer100g, item.name),
  };
}

export function enrichFoodItems(items: FoodItem[]): FoodItem[] {
  return items.map(enrichFoodItem);
}
