import { describe, expect, it } from "vitest";
import { foodBankShouldUploadLocal, mergeFoodBankItems, parseFoodItems } from "./foodBankCloud";
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

  it("lets the preferred food-bank row win on portion and macros", () => {
    const staleLocal = item({
      name: "Vitaminbamser",
      portionLabel: "100 g",
      portionGrams: 100,
      isCustom: true,
      nutritionPer100g: {
        kcal: 350,
        protein: 5,
        carbs: 80,
        fat: 1,
        fiber: 0,
        sugar: 70,
        saturatedFat: 0,
        sodium: 0,
        water: 2,
      },
    });
    const trainerUpdate = item({
      name: "Vitaminbamser",
      portionLabel: "1 stk",
      portionGrams: 1,
      isCustom: true,
      nutritionPer100g: {
        kcal: 4,
        protein: 0,
        carbs: 0.8,
        fat: 0,
        fiber: 0,
        sugar: 0.7,
        saturatedFat: 0,
        sodium: 0,
      },
    });

    const merged = mergeFoodBankItems([trainerUpdate], [staleLocal]);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({
      portionLabel: "1 stk",
      portionGrams: 1,
    });
    expect(merged[0]?.nutritionPer100g.kcal).toBe(4);
    expect(merged[0]?.nutritionPer100g.water).toBe(2);
  });
});
