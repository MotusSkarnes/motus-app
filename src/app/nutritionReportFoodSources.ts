import { FOOD_MICRONUTRIENT_FIELDS, type FoodMicronutrientKey } from "./foodBankMicronutrients";
import { normalizeFoodBankNameKey } from "./foodBankNameKey";
import type { FoodItem, FoodNutrition } from "./foodBankTypes";
import { formatMacro } from "./foodBankTypes";
import { foodWaterPer100g } from "./foodBankWater";
import { foodSourceFamilyKey } from "./foodSourceFamily";
import { isImpracticalHundredGramFoodSource } from "./foodSourcePracticality";
import { hasKnownNutrientValue } from "./nutritionReportCoverage";
import type { NutrientContributionId } from "./nutritionReportContributors";

export const FOOD_SOURCE_TOP_N = 10;
export const FOOD_SOURCE_EXPANDED_N = 50;

export type FoodBankNutrientSource = {
  id: string;
  name: string;
  nameKey: string;
  amountPer100g: number;
};

const SKIP_SOURCE_IDS = new Set<NutrientContributionId>([
  "kcal",
  "sugar",
  "saturatedFat",
  "sodium",
  "drinkWater",
  "waterFromFood",
]);

export function rankFoodBankSourcesForNutrient(
  items: FoodItem[],
  id: NutrientContributionId,
  options: { limit?: number; hiddenNameKeys?: Iterable<string> } = {},
): FoodBankNutrientSource[] {
  const limit = options.limit ?? FOOD_SOURCE_TOP_N;
  const hidden = new Set(options.hiddenNameKeys ?? []);
  const best = new Map<string, FoodBankNutrientSource>();
  for (const item of items) {
    const name = item.name.trim();
    if (!name) continue;
    const key = normalizeFoodBankNameKey(name) || item.id;
    if (hidden.has(key)) continue;
    if (isImpracticalHundredGramFoodSource(name)) continue;
    const source = { id: item.id, name, grams: 100, nutritionPer100g: item.nutritionPer100g };
    if (!hasKnownNutrientValue(source, id)) continue;
    const amountPer100g = amountPer100gForNutrient(item.nutritionPer100g, id);
    if (!(amountPer100g > 0)) continue;
    const family = foodSourceFamilyKey(name);
    const previous = best.get(family);
    if (!previous || amountPer100g > previous.amountPer100g) {
      best.set(family, { id: item.id, name, amountPer100g, nameKey: key });
    }
  }
  return [...best.values()]
    .sort((a, b) => b.amountPer100g - a.amountPer100g || a.name.localeCompare(b.name, "nb"))
    .slice(0, limit);
}

export function canSuggestFoodSources(id: NutrientContributionId | undefined): boolean {
  return Boolean(id) && !SKIP_SOURCE_IDS.has(id);
}

export function nutrientAmountMeta(id: NutrientContributionId): { unit: string; decimals: number } {
  switch (id) {
    case "kcal":
      return { unit: "kcal", decimals: 0 };
    case "sodium":
      return { unit: "mg", decimals: 0 };
    case "waterFromFood":
    case "waterTotal":
    case "drinkWater":
      return { unit: "g", decimals: 1 };
    case "monounsaturatedFat":
    case "polyunsaturatedFat":
    case "omega3":
    case "omega6":
    case "epa":
    case "dha":
    case "ala":
    case "epaDha":
      return { unit: "g", decimals: 2 };
    case "protein":
    case "carbs":
    case "fat":
    case "fiber":
    case "sugar":
    case "saturatedFat":
      return { unit: "g", decimals: 1 };
    default: {
      const field = FOOD_MICRONUTRIENT_FIELDS.find((row) => row.key === id);
      return { unit: field?.unit ?? "g", decimals: field?.decimals ?? 1 };
    }
  }
}

export function amountPer100gForNutrient(nutrition: FoodNutrition, id: NutrientContributionId): number {
  const fa = nutrition.fattyAcids;
  switch (id) {
    case "kcal":
      return Number(nutrition.kcal) || 0;
    case "protein":
      return Number(nutrition.protein) || 0;
    case "carbs":
      return Number(nutrition.carbs) || 0;
    case "fat":
      return Number(nutrition.fat) || 0;
    case "fiber":
      return Number(nutrition.fiber) || 0;
    case "sugar":
      return Number(nutrition.sugar) || 0;
    case "saturatedFat":
      return Number(nutrition.saturatedFat) || 0;
    case "sodium":
      return Number(nutrition.sodium) || 0;
    case "waterFromFood":
    case "waterTotal":
      return foodWaterPer100g(nutrition) || 0;
    case "drinkWater":
      return 0;
    case "monounsaturatedFat":
      return Number(fa?.monounsaturatedFat) || 0;
    case "polyunsaturatedFat":
      return Number(fa?.polyunsaturatedFat) || 0;
    case "omega3":
      return Number(fa?.omega3) || 0;
    case "omega6":
      return Number(fa?.omega6) || 0;
    case "epa":
      return Number(fa?.epa) || 0;
    case "dha":
      return Number(fa?.dha) || 0;
    case "ala":
      return Number(fa?.ala) || 0;
    case "epaDha":
      return (Number(fa?.epa) || 0) + (Number(fa?.dha) || 0);
    default:
      return Number(nutrition.micronutrients?.[id as FoodMicronutrientKey]) || 0;
  }
}

export function formatFoodSourceAmount(amount: number, id: NutrientContributionId): string {
  const { unit, decimals } = nutrientAmountMeta(id);
  return `${formatMacro(amount, decimals)} ${unit} / 100 g`;
}
