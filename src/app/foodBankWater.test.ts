import { describe, expect, it } from "vitest";
import type { FoodNutrition } from "./foodBankTypes";
import { foodWaterPer100g, mineralMassGrams } from "./foodBankWater";

function nutrition(partial: Partial<FoodNutrition>): FoodNutrition {
  return {
    kcal: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0,
    sugar: 0,
    saturatedFat: 0,
    sodium: 0,
    ...partial,
  };
}

describe("foodWaterPer100g", () => {
  it("keeps cucumber-level water when minerals are low", () => {
    expect(foodWaterPer100g(nutrition({ water: 95, sodium: 10, protein: 0.6, carbs: 2 }))).toBe(95);
  });

  it("keeps drink water at 100 g when sodium is not salt-level", () => {
    expect(foodWaterPer100g(nutrition({ water: 100, sodium: 5 }))).toBe(100);
  });

  it("treats Matvaretabellen havsalt (water-by-difference 100 g) as dry", () => {
    const havsalt = nutrition({ water: 100, sodium: 37600 });
    expect(mineralMassGrams(havsalt)).toBeCloseTo(94, 0);
    expect(foodWaterPer100g(havsalt)).toBe(0);
  });

  it("treats mineral salt with high potassium the same way", () => {
    expect(
      foodWaterPer100g(
        nutrition({
          water: 100,
          sodium: 20000,
          micronutrients: { potassium: 21000, magnesium: 1000, calcium: 43, phosphorus: 70 },
        }),
      ),
    ).toBe(0);
  });

  it("does not zero soy sauce: salty but actually watery with macros", () => {
    expect(
      foodWaterPer100g(
        nutrition({ water: 71, sodium: 5600, protein: 8, carbs: 5, fat: 0 }),
      ),
    ).toBe(71);
  });

  it("keeps measured 0 and omitted water distinct", () => {
    expect(foodWaterPer100g(nutrition({ water: 0, sodium: 37600 }))).toBe(0);
    expect(foodWaterPer100g(nutrition({ sodium: 37600 }))).toBeUndefined();
  });
});
