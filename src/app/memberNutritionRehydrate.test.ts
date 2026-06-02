import { describe, expect, it } from "vitest";
import {
  buildNutritionLookupByFoodName,
  normalizeFoodLookupKey,
  rehydrateMemberMealPlanState,
  mergeNutritionWithBank,
  resolveNutritionFromFoodItems,
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
    const { next, updates } = rehydrateMemberMealPlanState(state, [food("Agurk", 95)]);
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

  it("prefers duplicate food name entry with richer nutrition data", () => {
    const sparse = food("Olden Mineralvann", 0);
    const rich = food("Olden Mineralvann", 99);
    const lookup = buildNutritionLookupByFoodName([sparse, rich]);
    const resolved = resolveNutritionFromLookup("Olden Mineralvann", sparse.nutritionPer100g, lookup);
    expect(resolved.water).toBe(99);
  });

  it("matches fuzzy log name to food bank entry for water", () => {
    const bank = food("Olden, mineralvann uten kullsyre", 100);
    const stored = {
      kcal: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
      sugar: 0,
      saturatedFat: 0,
      sodium: 0,
      water: 0,
    };
    const resolved = resolveNutritionFromFoodItems("Olden uten kullsyre", stored, [bank]);
    expect(resolved.water).toBe(100);
  });

  it("merges water from all fuzzy bank matches when one duplicate lacks water", () => {
    const stale = food("Olden uten kullsyre", 0);
    stale.nutritionPer100g.kcal = 5;
    const rich = food("Olden, mineralvann uten kullsyre", 100);
    const stored = {
      kcal: 5,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
      sugar: 0,
      saturatedFat: 0,
      sodium: 0,
      water: 0,
    };
    const resolved = resolveNutritionFromFoodItems("Olden uten kullsyre", stored, [stale, rich]);
    expect(resolved.water).toBe(100);
    expect(resolved.kcal).toBe(5);
  });

  it("fills water from bank when log snapshot already has macros", () => {
    const bank = food("Olden, mineralvann uten kullsyre", 100);
    const stored = {
      kcal: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
      sugar: 0,
      saturatedFat: 0,
      sodium: 0,
      water: 0,
    };
    const withMacros = { ...stored, kcal: 1, protein: 0, carbs: 0, fat: 0 };
    const resolved = resolveNutritionFromFoodItems("Olden uten kullsyre", withMacros, [bank]);
    expect(resolved.kcal).toBe(1);
    expect(resolved.water).toBe(100);
    expect(mergeNutritionWithBank(withMacros, bank.nutritionPer100g).water).toBe(100);
  });
});
