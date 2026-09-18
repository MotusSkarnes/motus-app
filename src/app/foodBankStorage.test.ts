import { afterEach, describe, expect, it } from "vitest";
import {
  FOOD_BANK_STORAGE_KEY,
  loadFoodBankItems,
  persistFoodBankItems,
} from "./foodBankStorage";
import type { FoodItem } from "./foodBankTypes";

function vitaminbamser(overrides: Partial<FoodItem> = {}): FoodItem {
  return {
    id: "food-vitaminbamser",
    name: "Vitaminbamser",
    portionLabel: "1 stk",
    portionGrams: 1,
    category: "frukt-baer",
    origin: "Egen",
    source: "egen",
    createdBy: "PT",
    createdAt: "2026-09-01T00:00:00.000Z",
    isCustom: true,
    nutritionPer100g: {
      kcal: 4,
      protein: 0,
      carbs: 0.8,
      fat: 0,
      fiber: 0,
      sugar: 0,
      saturatedFat: 0,
      sodium: 0,
      micronutrients: { vitaminA: 800, copper: 0 },
    },
    ...overrides,
  };
}

afterEach(() => {
  localStorage.removeItem(FOOD_BANK_STORAGE_KEY);
});

describe("food bank load cache", () => {
  it("does not rewrite storage on a second load", () => {
    persistFoodBankItems([vitaminbamser()]);
    const first = loadFoodBankItems();
    const rawAfterFirst = localStorage.getItem(FOOD_BANK_STORAGE_KEY);
    const second = loadFoodBankItems();
    expect(second).toBe(first);
    expect(localStorage.getItem(FOOD_BANK_STORAGE_KEY)).toBe(rawAfterFirst);
  });
});

describe("food bank micronutrient zeros", () => {
  it("keeps measured 0 on a custom food after save and reload", () => {
    persistFoodBankItems([vitaminbamser()]);
    const loaded = loadFoodBankItems().find((item) => item.id === "food-vitaminbamser");
    expect(loaded?.nutritionPer100g.micronutrients?.vitaminA).toBe(800);
    expect(loaded?.nutritionPer100g.micronutrients?.copper).toBe(0);
    expect(loaded?.nutritionPer100g.micronutrients?.iron).toBeUndefined();
  });
});

describe("food bank water", () => {
  it("keeps measured water 0 on a custom food after save and reload", () => {
    persistFoodBankItems([
      vitaminbamser({
        nutritionPer100g: { ...vitaminbamser().nutritionPer100g, water: 0 },
      }),
    ]);
    const loaded = loadFoodBankItems().find((item) => item.id === "food-vitaminbamser");
    expect(loaded?.nutritionPer100g.water).toBe(0);
  });

  it("keeps omitted water as unknown after save and reload", () => {
    persistFoodBankItems([vitaminbamser()]);
    const loaded = loadFoodBankItems().find((item) => item.id === "food-vitaminbamser");
    expect(loaded?.nutritionPer100g.water).toBeUndefined();
  });
});

describe("food bank unit grams cleanup", () => {
  it("fjerner brød-enheter som ble limt på brødkrutonger", () => {
    persistFoodBankItems([
      vitaminbamser({
        id: "food-croutons",
        name: "Brødkrutonger",
        unitGrams: { ss: 4, skive: 38, stk: 500 },
      }),
    ]);
    const loaded = loadFoodBankItems().find((item) => item.id === "food-croutons");
    expect(loaded?.unitGrams).toEqual({ ss: 4 });
  });
});
