import { describe, expect, it } from "vitest";
import {
  buildNutritionLookupByFoodName,
  mergeMemberMealPlanStatesForNutritionRehydrate,
  normalizeFoodLookupKey,
  rehydrateMemberMealPlanState,
  resolveNutritionFromLookup,
} from "./memberNutritionRehydrate";
import type { FoodItem } from "./foodBankTypes";
import { EMPTY_MEMBER_MEAL_PLAN_STATE, type MemberQuickFoodLogEntry } from "./memberMealPlanState";

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

function quickLog(id: string, loggedAt: string, water = 0): MemberQuickFoodLogEntry {
  return {
    id,
    name: "Agurk",
    grams: 100,
    source: "food",
    loggedAt,
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

  it("preserves quick logs from every linked member state before rehydrating nutrition", () => {
    const lookup = buildNutritionLookupByFoodName([food("Agurk", 95)]);
    const merged = mergeMemberMealPlanStatesForNutritionRehydrate([
      {
        ...EMPTY_MEMBER_MEAL_PLAN_STATE,
        quickFoodLogs: {
          "2026-06-02": [quickLog("log-primary", "2026-06-02T08:00:00.000Z")],
        },
        savedMeals: [
          {
            id: "saved-primary",
            name: "Frokost",
            items: [
              {
                name: "Agurk",
                grams: 100,
                source: "food",
                nutritionPer100g: quickLog("unused", "2026-06-02T08:00:00.000Z").nutritionPer100g,
              },
            ],
            createdAt: "2026-06-01T00:00:00.000Z",
            updatedAt: "2026-06-01T00:00:00.000Z",
          },
        ],
        updatedAt: "2026-06-01T10:00:00.000Z",
      },
      {
        ...EMPTY_MEMBER_MEAL_PLAN_STATE,
        quickFoodLogs: {
          "2026-06-02": [quickLog("log-linked", "2026-06-02T12:00:00.000Z")],
        },
        updatedAt: "2026-06-02T10:00:00.000Z",
      },
    ]);

    expect(merged).not.toBeNull();
    const { next, updates } = rehydrateMemberMealPlanState(merged!, lookup);

    expect(updates).toBe(3);
    expect(next.quickFoodLogs["2026-06-02"]?.map((entry) => entry.id)).toEqual(["log-primary", "log-linked"]);
    expect(next.quickFoodLogs["2026-06-02"]?.map((entry) => entry.nutritionPer100g.water)).toEqual([95, 95]);
    expect(next.savedMeals.map((meal) => meal.id)).toEqual(["saved-primary"]);
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
