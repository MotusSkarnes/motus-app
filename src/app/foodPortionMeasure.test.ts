import { describe, expect, it } from "vitest";
import {
  defaultFoodLogQuantityForUnit,
  defaultFoodLogUnitForItem,
  foodLogUnitOptionsForItem,
  foodMeasureOptionsForItem,
  formatLoggedQuantityLabel,
  resolveFoodLogGrams,
  resolveFoodLogGramsForUnit,
} from "./foodPortionMeasure";
import type { FoodItem } from "./foodBankTypes";

function food(partial: Partial<FoodItem>): FoodItem {
  return {
    id: "f1",
    name: "Helmelk",
    portionLabel: "1 dl",
    portionGrams: 100,
    category: "meieriprodukter",
    origin: "",
    source: "matvaretabell",
    createdBy: "",
    createdAt: "",
    nutritionPer100g: { kcal: 50, protein: 3, carbs: 5, fat: 2, fiber: 0, sugar: 0, saturatedFat: 0, sodium: 0 },
    ...partial,
  };
}

describe("foodPortionMeasure", () => {
  it("offers gram and portion when food has portion", () => {
    const options = foodMeasureOptionsForItem(food({}));
    expect(options.map((o) => o.mode)).toEqual(["grams", "portion"]);
  });

  it("lists registered household units from the meal builder", () => {
    const item = food({
      name: "Avokado",
      portionLabel: "1/2 stk",
      portionGrams: 100,
      unitGrams: { "stk liten": 120, stk: 200, "stk stor": 280, ss: 15 },
    });
    const units = foodLogUnitOptionsForItem(item).map((option) => option.unit);
    expect(units).toContain("g");
    expect(units).toContain("stk");
    expect(units).toContain("stk liten");
    expect(units).toContain("stk stor");
    expect(units).toContain("ss");
  });

  it("defaults to the food portion unit and converts amount to grams", () => {
    const item = food({});
    expect(defaultFoodLogUnitForItem(item)).toBe("dl");
    expect(defaultFoodLogQuantityForUnit(item, "dl")).toBe("1");
    expect(resolveFoodLogGramsForUnit(2, 100)).toBe(200);
  });

  it("converts portion count to grams", () => {
    const item = food({});
    const grams = resolveFoodLogGrams(item, "portion", 2, 100);
    expect(grams).toBe(200);
  });

  it("does not display a 100 g log as 100 pieces after portion is changed to 1 g", () => {
    const item = food({ portionLabel: "1 stk", portionGrams: 1 });
    expect(formatLoggedQuantityLabel(item, 100)).toBe("100 g");
    expect(formatLoggedQuantityLabel(item, 1)).toBe("1 stk");
  });
});
