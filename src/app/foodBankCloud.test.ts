import { describe, expect, it } from "vitest";
import { foodBankShouldUploadLocal, parseFoodItems } from "./foodBankCloud";
import type { FoodItem } from "./foodBankTypes";

function item(overrides: Partial<FoodItem> = {}): FoodItem {
  return {
    id: "food-1",
    name: "Test",
    portionLabel: "100 g",
    portionGrams: 100,
    category: "proteinkilder",
    origin: "Test",
    source: "egen",
    createdBy: "PT",
    createdAt: "2026-01-01T00:00:00.000Z",
    nutritionPer100g: {
      kcal: 100,
      protein: 10,
      carbs: 5,
      fat: 2,
      fiber: 0,
      sugar: 0,
      saturatedFat: 0,
      sodium: 0,
    },
    ...overrides,
  };
}

describe("foodBankCloud", () => {
  it("parses valid food items from json", () => {
    const parsed = parseFoodItems([item(), { name: "broken" }]);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.name).toBe("Test");
  });

  it("detects when local bank should upload to cloud", () => {
    expect(foodBankShouldUploadLocal([item()], [], [])).toBe(false);
    expect(foodBankShouldUploadLocal([item({ isCustom: true })], [], [])).toBe(true);
    expect(foodBankShouldUploadLocal([item()], ["food-1"], [])).toBe(true);
    expect(foodBankShouldUploadLocal([item({ source: "matvaretabell" })], [], [])).toBe(true);
  });
});
