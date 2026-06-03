import { formatMacro } from "./foodBankTypes";
import { HEALTH_DIRECTORATE_OTHER_DAILY } from "./healthDirectorateNutritionReferences";
import type { MealPlanTargets } from "./mealPlanTypes";
import type { NutritionReferenceContext } from "./personalizedNutritionReferences";
import type { FoodLogNutritionTotals } from "./quickFoodLogNutrition";
import { EMPTY_FOOD_LOG_NUTRITION } from "./quickFoodLogNutrition";

export const DEFAULT_DAILY_KCAL_TARGET = 1900;
/** Anbefalt daglig væske (liter) — referanse for totalt vanninntak i rapport. */
export const DEFAULT_DAILY_WATER_L = 2.5;

export function totalWaterLiters(totals: Pick<FoodLogNutritionTotals, "waterLiters" | "drinkWaterLiters">): number {
  return (totals.waterLiters ?? 0) + (totals.drinkWaterLiters ?? 0);
}

export function normalizeFoodLogNutritionTotals(totals: Partial<FoodLogNutritionTotals>): FoodLogNutritionTotals {
  return {
    ...EMPTY_FOOD_LOG_NUTRITION,
    ...totals,
    waterLiters: Number(totals.waterLiters ?? 0) || 0,
    drinkWaterLiters: Number(totals.drinkWaterLiters ?? 0) || 0,
    fattyAcids: { ...EMPTY_FOOD_LOG_NUTRITION.fattyAcids, ...(totals.fattyAcids ?? {}) },
    micronutrients: { ...EMPTY_FOOD_LOG_NUTRITION.micronutrients, ...(totals.micronutrients ?? {}) },
  };
}

export function buildWaterReportRows(totals: FoodLogNutritionTotals): MacroDisplayRow[] {
  const normalized = normalizeFoodLogNutritionTotals(totals);
  return [
    {
      label: "Vann (fra mat)",
      value: normalized.waterLiters,
      unit: "L",
      target: 0,
      decimals: 1,
    },
    {
      label: "Vann (drikke)",
      value: normalized.drinkWaterLiters,
      unit: "L",
      target: 0,
      decimals: 1,
    },
    {
      label: "Vann (totalt)",
      value: totalWaterLiters(normalized),
      unit: "L",
      target: DEFAULT_DAILY_WATER_L,
      decimals: 1,
    },
  ];
}

export type MacroDisplayRow = {
  label: string;
  value: number;
  unit: string;
  target: number;
  decimals: number;
  lowerIsBetter?: boolean;
};

export function buildMacroDisplayRows(
  totals: FoodLogNutritionTotals,
  targets: MealPlanTargets | null | undefined,
  referenceContext?: Pick<NutritionReferenceContext, "otherDaily">,
): MacroDisplayRow[] {
  const normalized = normalizeFoodLogNutritionTotals(totals);
  const otherDaily = referenceContext?.otherDaily ?? HEALTH_DIRECTORATE_OTHER_DAILY;
  const kcalTarget = targets?.kcal && targets.kcal > 0 ? targets.kcal : DEFAULT_DAILY_KCAL_TARGET;
  return [
    { label: "Kalorier", value: normalized.kcal, unit: "kcal", target: kcalTarget, decimals: 0 },
    { label: "Protein", value: normalized.protein, unit: "g", target: targets?.protein ?? 0, decimals: 1 },
    { label: "Karbohydrater", value: normalized.carbs, unit: "g", target: targets?.carbs ?? 0, decimals: 1 },
    { label: "Fett", value: normalized.fat, unit: "g", target: targets?.fat ?? 0, decimals: 1 },
    { label: "Fiber", value: normalized.fiber, unit: "g", target: otherDaily.fiber, decimals: 1 },
    { label: "Sukker", value: normalized.sugar, unit: "g", target: 0, decimals: 1 },
    {
      label: "Mettet fett",
      value: normalized.saturatedFat,
      unit: "g",
      target: otherDaily.saturatedFat,
      decimals: 1,
    },
    {
      label: "Natrium",
      value: normalized.sodium,
      unit: "mg",
      target: otherDaily.sodium,
      decimals: 0,
      lowerIsBetter: true,
    },
  ];
}

export function macroCoveragePct(value: number, target: number, lowerIsBetter?: boolean): number {
  if (target <= 0) return 0;
  if (lowerIsBetter) {
    if (value <= target) return 100;
    return Math.max(0, Math.round((target / value) * 100));
  }
  return Math.min(100, Math.round((value / target) * 100));
}

export function formatMacroDisplayValue(row: MacroDisplayRow): string {
  return `${formatMacro(row.value, row.decimals)} ${row.unit}`;
}
