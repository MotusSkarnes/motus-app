import { describe, expect, it } from "vitest";
import type { FoodItem, FoodNutrition } from "./foodBankTypes";
import {
  FOOD_SOURCE_TOP_N,
  canSuggestFoodSources,
  formatFoodSourceAmount,
  rankFoodBankSourcesForNutrient,
} from "./nutritionReportFoodSources";

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

function food(name: string, nutritionPer100g: FoodNutrition, id = name): FoodItem {
  return {
    id,
    name,
    portionLabel: "100 g",
    portionGrams: 100,
    category: "proteinkilder",
    origin: "Test",
    source: "egen",
    createdBy: "test",
    createdAt: "2026-09-01T00:00:00.000Z",
    nutritionPer100g,
  };
}

describe("rankFoodBankSourcesForNutrient", () => {
  it("returns the top foods with a known amount per 100 g", () => {
    const items = [
      food("Eple", nutrition({ micronutrients: { vitaminB1: 0.02 } })),
      food("Havregryn", nutrition({ micronutrients: { vitaminB1: 0.45 } })),
      food("Svin indrefilet", nutrition({ micronutrients: { vitaminB1: 0.9 } })),
      food("Ukjent ost", nutrition({ protein: 20 })),
    ];
    const ranked = rankFoodBankSourcesForNutrient(items, "vitaminB1");
    expect(ranked.map((row) => row.name)).toEqual(["Svin indrefilet", "Havregryn", "Eple"]);
    expect(ranked[0]?.amountPer100g).toBe(0.9);
    expect(formatFoodSourceAmount(0.9, "vitaminB1")).toBe("0.90 mg / 100 g");
  });

  it("includes a newly added food the next time the list is ranked", () => {
    const base = [
      food("Havregryn", nutrition({ micronutrients: { vitaminB1: 0.45 } })),
      food("Svin indrefilet", nutrition({ micronutrients: { vitaminB1: 0.9 } })),
    ];
    expect(rankFoodBankSourcesForNutrient(base, "vitaminB1")[0]?.name).toBe("Svin indrefilet");

    const withNew = [
      ...base,
      food("Gjær, tørr", nutrition({ micronutrients: { vitaminB1: 12 } })),
    ];
    expect(rankFoodBankSourcesForNutrient(withNew, "vitaminB1")[0]?.name).toBe("Gjær, tørr");
  });

  it("keeps only the strongest duplicate name and caps at top 10", () => {
    const items = Array.from({ length: 12 }, (_, index) =>
      food(`Mat ${index + 1}`, nutrition({ micronutrients: { iron: index + 1 } })),
    );
    items.push(food("Mat 12", nutrition({ micronutrients: { iron: 99 } }), "mat-12-b"));
    const ranked = rankFoodBankSourcesForNutrient(items, "iron");
    expect(ranked).toHaveLength(FOOD_SOURCE_TOP_N);
    expect(ranked[0]).toMatchObject({ name: "Mat 12", amountPer100g: 99 });
  });

  it("does not suggest sources for nutrients where less is better", () => {
    expect(canSuggestFoodSources("vitaminB1")).toBe(true);
    expect(canSuggestFoodSources("protein")).toBe(true);
    expect(canSuggestFoodSources("sugar")).toBe(false);
    expect(canSuggestFoodSources("sodium")).toBe(false);
  });
});
