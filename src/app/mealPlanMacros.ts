import type { FoodNutrition } from "./foodBankTypes";
import { formatMacro } from "./foodBankTypes";
import type { MealPlanDay, MealPlanFoodEntry, MealPlanMeal, MealPlanTargets } from "./mealPlanTypes";

export type MacroTotals = {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
};

export const EMPTY_MACRO_TOTALS: MacroTotals = { kcal: 0, protein: 0, carbs: 0, fat: 0 };

export function computeMacrosForGrams(nutritionPer100g: FoodNutrition, grams: number): MacroTotals {
  const safeGrams = Number.isFinite(grams) && grams > 0 ? grams : 0;
  const factor = safeGrams / 100;
  return {
    kcal: nutritionPer100g.kcal * factor,
    protein: nutritionPer100g.protein * factor,
    carbs: nutritionPer100g.carbs * factor,
    fat: nutritionPer100g.fat * factor,
  };
}

export function computeEntryMacros(entry: Pick<MealPlanFoodEntry, "grams" | "nutritionPer100g">): MacroTotals {
  return computeMacrosForGrams(entry.nutritionPer100g, entry.grams);
}

export function sumMacroTotals(rows: MacroTotals[]): MacroTotals {
  return rows.reduce(
    (acc, row) => ({
      kcal: acc.kcal + row.kcal,
      protein: acc.protein + row.protein,
      carbs: acc.carbs + row.carbs,
      fat: acc.fat + row.fat,
    }),
    { ...EMPTY_MACRO_TOTALS },
  );
}

export function computeMealMacros(meal: MealPlanMeal): MacroTotals {
  return sumMacroTotals(meal.items.map((item) => computeEntryMacros(item)));
}

export function computeDayMacros(day: MealPlanDay): MacroTotals {
  return sumMacroTotals(day.meals.map((meal) => computeMealMacros(meal)));
}

export function formatMacroTotals(totals: MacroTotals): string {
  return `${formatMacro(totals.kcal)} kcal · P ${formatMacro(totals.protein)} · K ${formatMacro(totals.carbs)} · F ${formatMacro(totals.fat)}`;
}

export function formatTargetsSummary(targets?: MealPlanTargets): string | null {
  if (!targets) return null;
  const parts: string[] = [];
  if (targets.kcal) parts.push(`${formatMacro(targets.kcal)} kcal`);
  if (targets.protein) parts.push(`P ${formatMacro(targets.protein)}`);
  if (targets.carbs) parts.push(`K ${formatMacro(targets.carbs)}`);
  if (targets.fat) parts.push(`F ${formatMacro(targets.fat)}`);
  return parts.length ? parts.join(" · ") : null;
}
