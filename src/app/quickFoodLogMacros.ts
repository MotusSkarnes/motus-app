import type { MemberQuickFoodLogEntry } from "./memberMealPlanState";
import { computeMacrosForGrams, EMPTY_MACRO_TOTALS, type MacroTotals } from "./mealPlanMacros";

export function sumQuickFoodLogMacros(logs: MemberQuickFoodLogEntry[] | undefined): MacroTotals {
  if (!logs?.length) return { ...EMPTY_MACRO_TOTALS };
  return logs.reduce((acc, entry) => {
    const part = computeMacrosForGrams(entry.nutritionPer100g, entry.grams);
    return {
      kcal: acc.kcal + part.kcal,
      protein: acc.protein + part.protein,
      carbs: acc.carbs + part.carbs,
      fat: acc.fat + part.fat,
    };
  }, { ...EMPTY_MACRO_TOTALS });
}
