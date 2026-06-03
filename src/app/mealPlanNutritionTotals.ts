import { EMPTY_FATTY_ACIDS, normalizeFattyAcids } from "./foodBankFattyAcids";
import { EMPTY_MICRONUTRIENTS, FOOD_MICRONUTRIENT_FIELDS } from "./foodBankMicronutrients";
import { resolveEntryNutritionForTotals, type MealPlanNutritionContext } from "./mealPlanFoodNutrition";
import { computeMacrosForGrams } from "./mealPlanMacros";
import type { MealPlan, MealPlanDay, MealPlanFoodEntry } from "./mealPlanTypes";
import {
  addFoodLogNutritionTotals,
  divideFoodLogNutritionTotals,
  EMPTY_FOOD_LOG_NUTRITION,
  waterLitersFromFoodGrams,
  type FoodLogNutritionTotals,
} from "./quickFoodLogNutrition";

export function mealPlanDayHasFood(day: MealPlanDay): boolean {
  return day.meals.some((meal) => meal.items.some((item) => item.grams > 0));
}

export function sumMealPlanFoodEntriesNutrition(
  entries: MealPlanFoodEntry[],
  context?: MealPlanNutritionContext,
): FoodLogNutritionTotals {
  if (!entries.length) {
    return { ...EMPTY_FOOD_LOG_NUTRITION, micronutrients: { ...EMPTY_MICRONUTRIENTS } };
  }

  return entries.reduce((acc, entry) => {
    const grams = entry.grams > 0 ? entry.grams : 0;
    const scale = grams / 100;
    const n = resolveEntryNutritionForTotals(entry, context);
    const macros = computeMacrosForGrams(n, grams);
    const micros = n.micronutrients ?? EMPTY_MICRONUTRIENTS;
    const fa = normalizeFattyAcids(n.fattyAcids);

    const nextMicros = { ...acc.micronutrients };
    for (const field of FOOD_MICRONUTRIENT_FIELDS) {
      nextMicros[field.key] += (micros[field.key] ?? 0) * scale;
    }

    const nextFa = { ...acc.fattyAcids };
    (Object.keys(nextFa) as Array<keyof typeof nextFa>).forEach((key) => {
      nextFa[key] += fa[key] * scale;
    });

    return {
      kcal: acc.kcal + macros.kcal,
      protein: acc.protein + macros.protein,
      carbs: acc.carbs + macros.carbs,
      fat: acc.fat + macros.fat,
      fiber: acc.fiber + n.fiber * scale,
      sugar: acc.sugar + n.sugar * scale,
      saturatedFat: acc.saturatedFat + n.saturatedFat * scale,
      sodium: acc.sodium + n.sodium * scale,
      waterLiters: acc.waterLiters + waterLitersFromFoodGrams(n.water, grams),
      fattyAcids: nextFa,
      micronutrients: nextMicros,
    };
  }, {
    ...EMPTY_FOOD_LOG_NUTRITION,
    fattyAcids: { ...EMPTY_FATTY_ACIDS },
    micronutrients: { ...EMPTY_MICRONUTRIENTS },
  });
}

export function sumMealPlanDayNutrition(day: MealPlanDay, context?: MealPlanNutritionContext): FoodLogNutritionTotals {
  const entries = day.meals.flatMap((meal) => meal.items);
  return sumMealPlanFoodEntriesNutrition(entries, context);
}

export type MealPlanNutritionReport = {
  dayTotals: Array<{ dayId: string; label: string; totals: FoodLogNutritionTotals }>;
  daysWithFood: number;
  periodSum: FoodLogNutritionTotals;
  dailyAverage: FoodLogNutritionTotals;
};

export function buildMealPlanNutritionReport(plan: MealPlan, context?: MealPlanNutritionContext): MealPlanNutritionReport {
  const dayTotals: MealPlanNutritionReport["dayTotals"] = [];

  for (const day of plan.days) {
    if (!mealPlanDayHasFood(day)) continue;
    dayTotals.push({
      dayId: day.id,
      label: day.label.trim() || "Dag",
      totals: sumMealPlanDayNutrition(day, context),
    });
  }

  let periodSum = { ...EMPTY_FOOD_LOG_NUTRITION, micronutrients: { ...EMPTY_MICRONUTRIENTS } };
  for (const row of dayTotals) {
    periodSum = addFoodLogNutritionTotals(periodSum, row.totals);
  }

  const daysWithFood = dayTotals.length;
  const dailyAverage = divideFoodLogNutritionTotals(periodSum, daysWithFood);

  return { dayTotals, daysWithFood, periodSum, dailyAverage };
}
