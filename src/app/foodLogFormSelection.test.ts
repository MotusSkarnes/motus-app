import { describe, expect, it } from "vitest";
import { resolveSelectedFoodFromBank } from "../features/nutrition/FoodLogFormFields";
import type { FoodItem } from "./foodBankTypes";

function food(partial: Partial<FoodItem> & Pick<FoodItem, "id" | "name">): FoodItem {
  return {
    portionLabel: "100 g",
    portionGrams: 100,
    category: "gronnsaker",
    origin: "seed",
    source: "egen",
    createdBy: "Motus",
    createdAt: "",
    nutritionPer100g: {
      kcal: 20,
      protein: 1,
      carbs: 4,
      fat: 0,
      fiber: 1,
      sugar: 2,
      saturatedFat: 0,
      sodium: 0,
    },
    ...partial,
  };
}

describe("resolveSelectedFoodFromBank", () => {
  it("keeps sticky food when id disappears after dedupe", () => {
    const selected = food({ id: "old-paprika", name: "Paprika" });
    const bank = [food({ id: "canonical-paprika", name: "Paprika" })];
    expect(resolveSelectedFoodFromBank(bank, selected)?.id).toBe("canonical-paprika");
  });

  it("keeps snapshot if food is gone entirely", () => {
    const selected = food({ id: "gone", name: "Paprika" });
    expect(resolveSelectedFoodFromBank([], selected)?.id).toBe("gone");
  });
});
