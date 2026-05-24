import { describe, expect, it } from "vitest";
import {
  FOOD_IMPORT_CSV_TEMPLATE,
  foodMatchKey,
  mergeFoodImports,
  parseMotusCsv,
} from "./foodBankImport";
import type { FoodItem } from "./foodBankTypes";

describe("foodBankImport", () => {
  it("parses motus csv template row", () => {
    const result = parseMotusCsv(FOOD_IMPORT_CSV_TEMPLATE, "Trener");
    expect(result.errors).toEqual([]);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.name).toBe("Kyllingbryst");
    expect(result.items[0]?.nutritionPer100g.protein).toBe(31);
  });

  it("merges without duplicating same name and source", () => {
    const existing: FoodItem[] = [
      {
        id: "food-1",
        name: "Laks",
        portionLabel: "100 g",
        portionGrams: 100,
        category: "proteinkilder",
        origin: "Fisk",
        source: "matvaretabell",
        createdBy: "PT",
        createdAt: "2024-01-01",
        nutritionPer100g: { kcal: 200, protein: 20, carbs: 0, fat: 13, fiber: 0, sugar: 0, saturatedFat: 0, sodium: 0 },
      },
    ];
    const imported: FoodItem[] = [
      {
        ...existing[0],
        id: "other-id",
        nutritionPer100g: { ...existing[0].nutritionPer100g, kcal: 210 },
      },
    ];
    const merged = mergeFoodImports(existing, imported, "skip");
    expect(merged.items).toHaveLength(1);
    expect(merged.skipped).toBe(1);
    expect(merged.items[0]?.nutritionPer100g.kcal).toBe(200);
  });

  it("updates existing rows when mode is update", () => {
    const existing: FoodItem[] = [
      {
        id: "food-1",
        name: "Laks",
        portionLabel: "100 g",
        portionGrams: 100,
        category: "proteinkilder",
        origin: "Fisk",
        source: "matvaretabell",
        createdBy: "PT",
        createdAt: "2024-01-01",
        nutritionPer100g: { kcal: 200, protein: 20, carbs: 0, fat: 13, fiber: 0, sugar: 0, saturatedFat: 0, sodium: 0 },
      },
    ];
    const imported: FoodItem[] = [{ ...existing[0], id: "other-id", nutritionPer100g: { ...existing[0].nutritionPer100g, kcal: 210 } }];
    const merged = mergeFoodImports(existing, imported, "update");
    expect(merged.updated).toBe(1);
    expect(merged.items[0]?.id).toBe("food-1");
    expect(merged.items[0]?.nutritionPer100g.kcal).toBe(210);
  });

  it("builds stable match keys", () => {
    expect(foodMatchKey({ name: "  Egg ", source: "egen" })).toBe("egen::egg");
  });
});
