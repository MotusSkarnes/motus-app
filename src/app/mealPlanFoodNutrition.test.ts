import { describe, expect, it } from "vitest";
import {
  hydrateMealPlanFoodNutrition,
  resolveEntryNutrition,
  resolveEntryNutritionForTotals,
} from "./mealPlanFoodNutrition";
import { computeEntryMacros } from "./mealPlanMacros";
import type { FoodItem } from "./foodBankTypes";
import type { MealPlan } from "./mealPlanTypes";

const bankFood: FoodItem = {
  id: "food-kylling",
  name: "Kyllingbryst",
  category: "protein",
  source: "trainer",
  portionGrams: 150,
  portionLabel: "150 g",
  nutritionPer100g: {
    kcal: 110,
    protein: 23,
    carbs: 0,
    fat: 1.5,
    fiber: 0,
    sugar: 0,
    saturatedFat: 0.3,
    sodium: 50,
    micronutrients: { vitaminC: 12 },
  },
};

describe("mealPlanFoodNutrition", () => {
  it("slår opp næring fra matvarebank når snapshot mangler", () => {
    const foodById = new Map([[bankFood.id, bankFood]]);
    const nutrition = resolveEntryNutrition(
      { foodId: bankFood.id, nutritionPer100g: { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, saturatedFat: 0, sodium: 0 } },
      foodById,
    );
    expect(nutrition.protein).toBe(23);
    const macros = computeEntryMacros(
      { foodId: bankFood.id, grams: 100, nutritionPer100g: { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, saturatedFat: 0, sodium: 0 } },
      foodById,
    );
    expect(macros.protein).toBe(23);
  });

  it("hydrerer matplan med næring fra banken", () => {
    const plan: MealPlan = {
      id: "p1",
      memberId: "m1",
      title: "Test",
      notes: "",
      days: [
        {
          id: "d1",
          label: "Mandag",
          meals: [
            {
              id: "meal1",
              name: "Lunsj",
              items: [
                {
                  id: "i1",
                  foodId: bankFood.id,
                  foodName: bankFood.name,
                  grams: 150,
                  nutritionPer100g: { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, saturatedFat: 0, sodium: 0 },
                },
              ],
            },
          ],
        },
      ],
      createdAt: "2026-01-01",
    };
    const hydrated = hydrateMealPlanFoodNutrition(plan, [bankFood]);
    expect(hydrated.days[0].meals[0].items[0].nutritionPer100g.protein).toBe(23);
  });

  it("henter mikronæringsstoffer fra matvarebank når snapshot bare har makro", () => {
    const foodById = new Map([[bankFood.id, bankFood]]);
    const oldSnapshot = {
      kcal: 110,
      protein: 23,
      carbs: 0,
      fat: 1.5,
      fiber: 0,
      sugar: 0,
      saturatedFat: 0.3,
      sodium: 50,
    };
    const nutrition = resolveEntryNutritionForTotals({ foodId: bankFood.id, nutritionPer100g: oldSnapshot }, { foodById });
    expect(nutrition.micronutrients?.vitaminC).toBe(12);
  });
});
