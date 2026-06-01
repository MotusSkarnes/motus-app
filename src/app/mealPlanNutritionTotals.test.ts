import { describe, expect, it } from "vitest";
import { createDefaultMealPlan } from "./mealPlanDefaults";
import { buildMealPlanNutritionReport, sumMealPlanDayNutrition } from "./mealPlanNutritionTotals";
import type { MealPlanFoodEntry } from "./mealPlanTypes";

const entry = (grams: number): MealPlanFoodEntry => ({
  id: "e1",
  foodId: "f1",
  foodName: "Test",
  grams,
  nutritionPer100g: {
    kcal: 100,
    protein: 10,
    carbs: 5,
    fat: 2,
    fiber: 1,
    sugar: 0.5,
    saturatedFat: 0.3,
    sodium: 50,
  },
});

describe("mealPlanNutritionTotals", () => {
  it("sums macros for a day from plan entries", () => {
    const plan = createDefaultMealPlan("m1");
    plan.days[0]!.meals[0]!.items = [entry(200)];
    const dayTotals = sumMealPlanDayNutrition(plan.days[0]!);
    expect(dayTotals.kcal).toBe(200);
    expect(dayTotals.protein).toBe(20);
  });

  it("builds report with daily average across days with food", () => {
    const plan = createDefaultMealPlan("m1");
    plan.days[0]!.meals[0]!.items = [entry(100)];
    plan.days[1]!.meals[0]!.items = [entry(300)];
    const report = buildMealPlanNutritionReport(plan);
    expect(report.daysWithFood).toBe(2);
    expect(report.dailyAverage.kcal).toBe(200);
  });
});
