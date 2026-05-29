import { describe, expect, it } from "vitest";
import { defaultPortionGramsForFood, defaultPortionLabelForFood } from "./foodPortionDefaults";
import type { FoodItem } from "./foodBankTypes";

function food(partial: Partial<FoodItem> & Pick<FoodItem, "name">): FoodItem {
  return {
    id: "f1",
    category: "proteinkilder",
    origin: "Test",
    source: "egen",
    createdBy: "test",
    createdAt: "2024-01-01T00:00:00.000Z",
    portionLabel: "100 g",
    portionGrams: 100,
    nutritionPer100g: {
      kcal: 100,
      protein: 10,
      carbs: 0,
      fat: 0,
      fiber: 0,
      sugar: 0,
      saturatedFat: 0,
      sodium: 0,
    },
    ...partial,
  };
}

describe("foodPortionDefaults", () => {
  it("bruker 130 g for skyr når porsjon ikke er satt", () => {
    expect(defaultPortionGramsForFood(food({ name: "Skyr naturell" }))).toBe(130);
    expect(defaultPortionLabelForFood(food({ name: "Skyr naturell" }))).toBe("1 beger");
  });

  it("beholder egendefinert porsjon fra matbanken", () => {
    expect(
      defaultPortionGramsForFood(
        food({ name: "Skyr naturell", portionLabel: "200 g", portionGrams: 200 }),
      ),
    ).toBe(200);
  });

  it("bruker alias for banan", () => {
    expect(defaultPortionGramsForFood(food({ name: "Banan" }))).toBe(120);
  });

  it("bruker alias for skyr", () => {
    expect(defaultPortionGramsForFood(food({ name: "Skyr" }))).toBe(130);
  });
});
