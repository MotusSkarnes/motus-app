import { describe, expect, it } from "vitest";
import {
  buildNutritionLookupByFoodName,
  normalizeFoodLookupKey,
  rehydrateMemberMealPlanState,
  resolveNutritionFromLookup,
} from "./memberNutritionRehydrate";
import type { FoodItem } from "./foodBankTypes";
import { EMPTY_MEMBER_MEAL_PLAN_STATE } from "./memberMealPlanState";

function food(name: string, water?: number): FoodItem {
  return {
    id: `food-${name}`,
    name,
    portionLabel: "100 g",
    portionGrams: 100,
    category: "gronnsaker",
    origin: "NO",
    source: "matvaretabell",
    createdBy: "test",
    createdAt: "2026-01-01T00:00:00.000Z",
    nutritionPer100g: {
      kcal: 10,
      protein: 1,
      carbs: 2,
      fat: 0,
      fiber: 0,
      sugar: 0,
      saturatedFat: 0,
      sodium: 0,
      water,
    },
  };
}

describe("memberNutritionRehydrate", () => {
  it("normalizes food names for lookup", () => {
    expect(normalizeFoodLookupKey("Tomat, rå")).toBe(normalizeFoodLookupKey("tomat ra"));
  });

  it("updates water in quick logs and saved meals from food bank", () => {
    const lookup = buildNutritionLookupByFoodName([food("Agurk", 95)]);
    const state = {
      ...EMPTY_MEMBER_MEAL_PLAN_STATE,
      quickFoodLogs: {
        "2026-06-02": [
          {
            id: "log-1",
            name: "Agurk",
            grams: 200,
            source: "food" as const,
            loggedAt: "2026-06-02T08:00:00.000Z",
            nutritionPer100g: {
              kcal: 10,
              protein: 1,
              carbs: 2,
              fat: 0,
              fiber: 0,
              sugar: 0,
              saturatedFat: 0,
              sodium: 0,
              water: 0,
            },
          },
        ],
      },
      savedMeals: [
        {
          id: "saved-1",
          name: "Frokost",
          items: [
            {
              name: "Agurk",
              grams: 100,
              source: "food" as const,
              nutritionPer100g: {
                kcal: 10,
                protein: 1,
                carbs: 2,
                fat: 0,
                fiber: 0,
                sugar: 0,
                saturatedFat: 0,
                sodium: 0,
                water: 0,
              },
            },
          ],
          createdAt: "2026-06-01T00:00:00.000Z",
          updatedAt: "2026-06-01T00:00:00.000Z",
        },
      ],
    };
    const { next, updates } = rehydrateMemberMealPlanState(state, lookup);
    expect(updates).toBe(2);
    expect(next.quickFoodLogs["2026-06-02"]![0]!.nutritionPer100g.water).toBe(95);
    expect(next.savedMeals[0]!.items[0]!.nutritionPer100g.water).toBe(95);
  });

  it("resolves nutrition when loading saved meal items", () => {
    const lookup = buildNutritionLookupByFoodName([food("Melon", 90)]);
    const resolved = resolveNutritionFromLookup(
      "Melon",
      {
        kcal: 1,
        protein: 0,
        carbs: 0,
        fat: 0,
        fiber: 0,
        sugar: 0,
        saturatedFat: 0,
        sodium: 0,
        water: 0,
      },
      lookup,
    );
    expect(resolved.water).toBe(90);
  });
});
