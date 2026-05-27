import { describe, expect, it } from "vitest";
import { computeEntryMacros, computeMealMacros, sumMacroTotals } from "./mealPlanMacros";
import type { MealPlanFoodEntry, MealPlanMeal } from "./mealPlanTypes";

const entry = (grams: number): MealPlanFoodEntry => ({
  id: "e1",
  foodId: "f1",
  foodName: "Test",
  grams,
  nutritionPer100g: { kcal: 100, protein: 10, carbs: 5, fat: 2, fiber: 0, sugar: 0, saturatedFat: 0, sodium: 0 },
});

describe("mealPlanMacros", () => {
  it("scales per 100g nutrition by grams", () => {
    expect(computeEntryMacros(entry(200)).kcal).toBe(200);
    expect(computeEntryMacros(entry(50)).protein).toBe(5);
  });

  it("sums meal macros", () => {
    const meal: MealPlanMeal = {
      id: "m1",
      name: "Frokost",
      items: [entry(100), entry(100)],
    };
    const totals = computeMealMacros(meal);
    expect(totals.kcal).toBe(200);
    expect(sumMacroTotals([totals, totals]).kcal).toBe(400);
  });
});
