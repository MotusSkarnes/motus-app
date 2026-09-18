import { describe, expect, it } from "vitest";
import { searchFoodBankItems } from "./foodBankSearch";
import type { FoodItem } from "./foodBankTypes";

function food(name: string, origin = ""): FoodItem {
  return {
    id: name,
    name,
    category: "gronnsaker",
    origin,
    source: "matvaretabell",
    createdBy: "test",
    createdAt: "2024-01-01T00:00:00.000Z",
    portionLabel: "100 g",
    portionGrams: 100,
    nutritionPer100g: {
      kcal: 40,
      protein: 1,
      carbs: 8,
      fat: 0,
      fiber: 2,
      sugar: 4,
      saturatedFat: 0,
      sodium: 0,
    },
  };
}

const BANK = [
  food("Grønnsaksblanding med gulrot, fryst"),
  food("Gulrotkake"),
  food("Gulrotjuice"),
  food("Gulrot, norsk, rå"),
  food("Gulrot"),
  food("Kyllingbryst"),
];

describe("searchFoodBankItems", () => {
  it("skjuler Motus-gulrot når tabellen har gulrot, rå", () => {
    const names = searchFoodBankItems(BANK, "gulrot").map((item) => item.name);
    expect(names[0]).toBe("Gulrot, norsk, rå");
    expect(names).not.toContain("Gulrot");
    expect(names).toContain("Gulrotkake");
    expect(names.at(-1)).toBe("Grønnsaksblanding med gulrot, fryst");
  });

  it("beholder egen kort gulrot", () => {
    const names = searchFoodBankItems(
      [...BANK, { ...food("Gulrot"), id: "food-custom-gulrot", isCustom: true, source: "egen" }],
      "gulrot",
    ).map((item) => item.name);
    expect(names).toContain("Gulrot");
    expect(names).toContain("Gulrot, norsk, rå");
  });

  it("finner gulrot selv om man skriver gulerot", () => {
    const names = searchFoodBankItems(BANK, "gulerot").map((item) => item.name);
    expect(names[0]).toBe("Gulrot, norsk, rå");
    expect(names).not.toContain("Gulrot");
    expect(names).not.toContain("Kyllingbryst");
  });
});
