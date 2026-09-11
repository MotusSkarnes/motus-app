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

describe("food bank micronutrient zeros", () => {
  it("keeps measured 0 on a custom food after save and reload", () => {
    persistFoodBankItems([vitaminbamser()]);
    const loaded = loadFoodBankItems().find((item) => item.id === "food-vitaminbamser");
    expect(loaded?.nutritionPer100g.micronutrients?.vitaminA).toBe(800);
    expect(loaded?.nutritionPer100g.micronutrients?.copper).toBe(0);
    expect(loaded?.nutritionPer100g.micronutrients?.iron).toBeUndefined();
  });
});
