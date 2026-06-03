import { formatMacro } from "./foodBankTypes";
import { HEALTH_DIRECTORATE_OTHER_DAILY } from "./healthDirectorateNutritionReferences";
import type { MealPlanTargets } from "./mealPlanTypes";
import type { NutritionReferenceContext } from "./personalizedNutritionReferences";
import type { FoodLogNutritionTotals } from "./quickFoodLogNutrition";

export const DEFAULT_DAILY_KCAL_TARGET = 1900;
/** Anbefalt daglig væske (liter) — referanse for totalt vanninntak i rapport. */
export const DEFAULT_DAILY_WATER_L = 2.5;

export function totalWaterLiters(totals: Pick<FoodLogNutritionTotals, "waterLiters" | "drinkWaterLiters">): number {
  return (totals.waterLiters ?? 0) + (totals.drinkWaterLiters ?? 0);
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
  const otherDaily = referenceContext?.otherDaily ?? HEALTH_DIRECTORATE_OTHER_DAILY;
  const kcalTarget = targets?.kcal && targets.kcal > 0 ? targets.kcal : DEFAULT_DAILY_KCAL_TARGET;
  return [
    { label: "Kalorier", value: totals.kcal, unit: "kcal", target: kcalTarget, decimals: 0 },
    { label: "Protein", value: totals.protein, unit: "g", target: targets?.protein ?? 0, decimals: 1 },
    { label: "Karbohydrater", value: totals.carbs, unit: "g", target: targets?.carbs ?? 0, decimals: 1 },
    { label: "Fett", value: totals.fat, unit: "g", target: targets?.fat ?? 0, decimals: 1 },
    { label: "Fiber", value: totals.fiber, unit: "g", target: otherDaily.fiber, decimals: 1 },
    { label: "Sukker", value: totals.sugar, unit: "g", target: 0, decimals: 1 },
    {
      label: "Mettet fett",
      value: totals.saturatedFat,
      unit: "g",
      target: otherDaily.saturatedFat,
      decimals: 1,
    },
    {
      label: "Natrium",
      value: totals.sodium,
      unit: "mg",
      target: otherDaily.sodium,
      decimals: 0,
      lowerIsBetter: true,
    },
    {
      label: "Vann (fra mat)",
      value: totals.waterLiters,
      unit: "L",
      target: 0,
      decimals: 1,
    },
    {
      label: "Vann (drikke)",
      value: totals.drinkWaterLiters,
      unit: "L",
      target: 0,
      decimals: 1,
    },
    {
      label: "Vann (totalt)",
      value: totalWaterLiters(totals),
      unit: "L",
      target: DEFAULT_DAILY_WATER_L,
      decimals: 1,
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
