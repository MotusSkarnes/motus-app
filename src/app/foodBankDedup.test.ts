import { describe, expect, it } from "vitest";
import { dedupeFoodBankItems, foodNutritionSignature } from "./foodBankDedup";
import type { FoodItem, FoodNutrition } from "./foodBankTypes";

function item(partial: Partial<FoodItem> & { name: string; nutritionPer100g: FoodNutrition }): FoodItem {
  return {
    id: partial.id ?? `food-test-${partial.name}`,
    portionLabel: "100 g",
    portionGrams: 100,
    category: partial.category ?? "karbohydrater",
    origin: "Test",
    source: partial.source ?? "matvaretabell",
    createdBy: "test",
    createdAt: "2024-01-01T00:00:00.000Z",
    ...partial,
  };
}

describe("foodBankDedup", () => {
  it("merger identisk navn med norsk ø", () => {
    const n: FoodNutrition = {
      kcal: 220,
      protein: 8,
      carbs: 42,
      fat: 2,
      fiber: 6,
      sugar: 3,
      saturatedFat: 0.4,
      sodium: 430,
    };
    const result = dedupeFoodBankItems([
      item({ id: "food-a", name: "Rugbrød", nutritionPer100g: n }),
      item({ id: "food-b", name: "Rugbrød", nutritionPer100g: n }),
    ]);
    expect(result.items).toHaveLength(1);
    expect(result.removedCount).toBe(1);
  });

  it("merger identisk navn", () => {
    const n: FoodNutrition = {
      kcal: 220,
      protein: 8,
      carbs: 42,
      fat: 2,
      fiber: 6,
      sugar: 3,
      saturatedFat: 0.4,
      sodium: 430,
    };
    const result = dedupeFoodBankItems([
      item({ id: "food-a", name: "Rugbrød", nutritionPer100g: n }),
      item({ id: "food-b", name: "  rugbrød ", nutritionPer100g: n }),
    ]);
    expect(result.items).toHaveLength(1);
    expect(result.idRemap["food-b"]).toBe("food-a");
  });

  it("merger ulikt navn ved identisk næring", () => {
    const n: FoodNutrition = {
      kcal: 248,
      protein: 8.6,
      carbs: 45.3,
      fat: 2.2,
      fiber: 6,
      sugar: 3,
      saturatedFat: 0.4,
      sodium: 430,
    };
    const result = dedupeFoodBankItems([
      item({ id: "food-a", name: "Rundstykke, grovt, kjøpt", nutritionPer100g: n }),
      item({
        id: "food-b",
        name: "Rundstykke, grovt, med salt tilsatt jod, kjøpt",
        nutritionPer100g: { ...n },
      }),
    ]);
    expect(result.items).toHaveLength(1);
    expect(result.idRemap["food-b"]).toBeTruthy();
  });

  it("beholder ulike varer med ulik næring (rugbrød vs grovt brød)", () => {
    const result = dedupeFoodBankItems([
      item({
        id: "food-rug",
        name: "Rugbrød",
        nutritionPer100g: {
          kcal: 220,
          protein: 8,
          carbs: 42,
          fat: 2,
          fiber: 6,
          sugar: 3,
          saturatedFat: 0.4,
          sodium: 430,
        },
      }),
      item({
        id: "food-grov",
        name: "Grovt brød",
        nutritionPer100g: {
          kcal: 247,
          protein: 9,
          carbs: 43,
          fat: 3.5,
          fiber: 7,
          sugar: 4,
          saturatedFat: 0.6,
          sodium: 400,
        },
      }),
    ]);
    expect(result.items).toHaveLength(2);
    expect(result.removedCount).toBe(0);
  });

  it("slår ikke sammen næringsløse rader med samme null-signatur", () => {
    const empty: FoodNutrition = {
      kcal: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
      sugar: 0,
      saturatedFat: 0,
      sodium: 0,
    };
    const result = dedupeFoodBankItems([
      item({ id: "food-a", name: "Vann A", nutritionPer100g: empty }),
      item({ id: "food-b", name: "Vann B", nutritionPer100g: empty }),
    ]);
    expect(result.items).toHaveLength(2);
    expect(foodNutritionSignature(empty)).toBe("0|0.0|0.0|0.0|0.0|0.0|0.0|0");
  });
});
