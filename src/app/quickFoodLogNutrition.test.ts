import { describe, expect, it } from "vitest";
import { sumQuickFoodLogNutrition } from "./quickFoodLogNutrition";
import type { MemberQuickFoodLogEntry } from "./memberMealPlanState";

describe("sumQuickFoodLogNutrition", () => {
  it("sums macros, fiber and micronutrients", () => {
    const logs: MemberQuickFoodLogEntry[] = [
      {
        id: "1",
        name: "Skyr",
        grams: 150,
        source: "food",
        mealId: "member-frokost",
        loggedAt: new Date().toISOString(),
        nutritionPer100g: {
          kcal: 60,
          protein: 10,
          carbs: 4,
          fat: 0.2,
          fiber: 0,
          sugar: 4,
          saturatedFat: 0,
          sodium: 40,
          micronutrients: {
            vitaminA: 0,
            vitaminD: 0,
            vitaminE: 0,
            vitaminC: 0,
            vitaminB1: 0,
            vitaminB2: 0,
            niacin: 0,
            vitaminB6: 0,
            folate: 100,
            vitaminB12: 0,
            calcium: 200,
            iron: 0,
            potassium: 0,
            magnesium: 0,
            phosphorus: 0,
            zinc: 0,
            selenium: 0,
            iodine: 0,
            copper: 0,
          },
        },
      },
    ];
    const totals = sumQuickFoodLogNutrition(logs);
    expect(Math.round(totals.kcal)).toBe(90);
    expect(Math.round(totals.micronutrients.folate)).toBe(150);
    expect(Math.round(totals.micronutrients.calcium)).toBe(300);
    expect(Math.round(totals.sodium)).toBe(60);
  });
});
