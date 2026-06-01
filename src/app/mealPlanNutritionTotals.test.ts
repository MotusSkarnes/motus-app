import { describe, expect, it } from "vitest";
import { createDefaultMealPlan } from "./mealPlanDefaults";
import { INSPIRATION_RECIPE_FOOD_PREFIX } from "./mealPlanRecipeEntry";
import { buildMealPlanNutritionReport, sumMealPlanDayNutrition } from "./mealPlanNutritionTotals";
import type { MealPlanFoodEntry } from "./mealPlanTypes";
import type { FoodNutrition } from "./foodBankTypes";

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

  it("bruker oppskrifts-beregning for mikro når lagret snapshot mangler det", () => {
    const plan = createDefaultMealPlan("m1");
    const recipeId = "recipe-1";
    const recipeNutrition: FoodNutrition = {
      kcal: 400,
      protein: 30,
      carbs: 40,
      fat: 10,
      fiber: 0,
      sugar: 0,
      saturatedFat: 0,
      sodium: 0,
      micronutrients: { iron: 5, vitaminC: 0, vitaminA: 0, vitaminD: 0, vitaminE: 0, vitaminB1: 0, vitaminB2: 0, niacin: 0, vitaminB6: 0, folate: 0, vitaminB12: 0, calcium: 0, potassium: 0, magnesium: 0, phosphorus: 0, zinc: 0, selenium: 0, iodine: 0, copper: 0 },
    };
    plan.days[0]!.meals[0]!.items = [
      {
        id: "r1",
        foodId: `${INSPIRATION_RECIPE_FOOD_PREFIX}${recipeId}`,
        foodName: "Laks og ris",
        grams: 100,
        nutritionPer100g: { kcal: 400, protein: 30, carbs: 40, fat: 10, fiber: 0, sugar: 0, saturatedFat: 0, sodium: 0 },
      },
    ];
    const report = buildMealPlanNutritionReport(plan, {
      recipeNutritionById: new Map([[recipeId, recipeNutrition]]),
    });
    expect(report.dayTotals[0]?.totals.micronutrients.iron).toBe(5);
  });
});
