import { describe, expect, it } from "vitest";
import { foodMeasureOptionsForItem, formatLoggedQuantityLabel, resolveFoodLogGrams } from "./foodPortionMeasure";
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
