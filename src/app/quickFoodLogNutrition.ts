import {
  EMPTY_MICRONUTRIENTS,
  FOOD_MICRONUTRIENT_FIELDS,
  type FoodMicronutrientKey,
  type FoodMicronutrients,
} from "./foodBankMicronutrients";
import type { MemberQuickFoodLogEntry } from "./memberMealPlanState";
import { computeMacrosForGrams, EMPTY_MACRO_TOTALS, type MacroTotals } from "./mealPlanMacros";
import { HEALTH_DIRECTORATE_MICRONUTRIENT_DAILY } from "./healthDirectorateNutritionReferences";

export type FoodLogNutritionTotals = MacroTotals & {
  fiber: number;
  sugar: number;
  saturatedFat: number;
  sodium: number;
  micronutrients: FoodMicronutrients;
};

export const EMPTY_FOOD_LOG_NUTRITION: FoodLogNutritionTotals = {
  ...EMPTY_MACRO_TOTALS,
  fiber: 0,
  sugar: 0,
  saturatedFat: 0,
  sodium: 0,
  micronutrients: { ...EMPTY_MICRONUTRIENTS },
};

export type MicronutrientDailyRow = {
  key: FoodMicronutrientKey;
  label: string;
  unit: string;
  decimals: number;
  value: number;
  target: number;
  coveragePct: number;
};

export function sumQuickFoodLogNutrition(logs: MemberQuickFoodLogEntry[] | undefined): FoodLogNutritionTotals {
  if (!logs?.length) return { ...EMPTY_FOOD_LOG_NUTRITION, micronutrients: { ...EMPTY_MICRONUTRIENTS } };

  return logs.reduce((acc, entry) => {
    const scale = entry.grams > 0 ? entry.grams / 100 : 0;
    const n = entry.nutritionPer100g;
    const macros = computeMacrosForGrams(n, entry.grams);
    const micros = n.micronutrients ?? EMPTY_MICRONUTRIENTS;

    const nextMicros = { ...acc.micronutrients };
    for (const field of FOOD_MICRONUTRIENT_FIELDS) {
      nextMicros[field.key] += (micros[field.key] ?? 0) * scale;
    }

    return {
      kcal: acc.kcal + macros.kcal,
      protein: acc.protein + macros.protein,
      carbs: acc.carbs + macros.carbs,
      fat: acc.fat + macros.fat,
      fiber: acc.fiber + n.fiber * scale,
      sugar: acc.sugar + n.sugar * scale,
      saturatedFat: acc.saturatedFat + n.saturatedFat * scale,
      sodium: acc.sodium + n.sodium * scale,
      micronutrients: nextMicros,
    };
  }, { ...EMPTY_FOOD_LOG_NUTRITION, micronutrients: { ...EMPTY_MICRONUTRIENTS } });
}

export function micronutrientRowsFromLogTotals(totals: FoodLogNutritionTotals): MicronutrientDailyRow[] {
  return FOOD_MICRONUTRIENT_FIELDS.map((field) => {
    const value = totals.micronutrients[field.key] ?? 0;
    const target = HEALTH_DIRECTORATE_MICRONUTRIENT_DAILY[field.key];
    const coveragePct = target > 0 ? (value / target) * 100 : 0;
    return {
      key: field.key,
      label: field.label,
      unit: field.unit,
      decimals: field.decimals,
      value,
      target,
      coveragePct,
    };
  });
}
