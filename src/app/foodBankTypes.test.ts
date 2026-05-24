import { describe, expect, it } from "vitest";
import { foodItemMayDelete, type FoodItem } from "./foodBankTypes";

function item(overrides: Partial<FoodItem> = {}): FoodItem {
  return {
    id: "food-1",
    name: "Kylling",
    portionLabel: "100 g",
    portionGrams: 100,
    category: "proteinkilder",
    origin: "Kjøtt",
    source: "matvaretabell",
    createdBy: "PT",
    createdAt: "2024-01-01",
    nutritionPer100g: { kcal: 100, protein: 20, carbs: 0, fat: 2, fiber: 0, sugar: 0, saturatedFat: 0, sodium: 0 },
    ...overrides,
  };
}

describe("foodItemMayDelete", () => {
  it("allows delete for custom and edited items only", () => {
    expect(foodItemMayDelete(item())).toBe(false);
    expect(foodItemMayDelete(item({ isCustom: true }))).toBe(true);
    expect(foodItemMayDelete(item({ isEdited: true }))).toBe(true);
  });
});
