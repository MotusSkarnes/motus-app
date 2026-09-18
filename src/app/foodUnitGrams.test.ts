import { describe, expect, it } from "vitest";
import type { FoodItem } from "./foodBankTypes";
import {
  gramsForIngredientDraft,
  hasRegisteredUnitWeight,
  inferredUnitGramsFromPortion,
  mergeUnitGramsMaps,
  registeredGramsPerUnit,
  withRegisteredUnitGrams,
} from "./foodUnitGrams";

function food(partial: Partial<FoodItem> & Pick<FoodItem, "name">): FoodItem {
  return {
    id: "f1",
    category: "meieriprodukter",
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

describe("foodUnitGrams", () => {
  it("regner 200 g per stk fra 1/2 stk avokado", () => {
    const avocado = food({
      name: "Avokado",
      portionLabel: "1/2 stk",
      portionGrams: 100,
    });
    expect(inferredUnitGramsFromPortion(avocado).stk).toBe(200);
    expect(gramsForIngredientDraft("1", "stk", avocado)).toBe(200);
    expect(hasRegisteredUnitWeight(avocado, "stk")).toBe(true);
  });

  it("regner 50 g per stk fra 2 stk egg", () => {
    const egg = food({ name: "Egg", portionLabel: "2 stk", portionGrams: 100 });
    expect(registeredGramsPerUnit(egg, "stk")).toBe(50);
  });

  it("finner dl i parentes uten å røre gram", () => {
    const oats = food({ name: "Havregryn", portionLabel: "40 g (1 dl)", portionGrams: 40 });
    expect(inferredUnitGramsFromPortion(oats).dl).toBe(40);
    expect(registeredGramsPerUnit(oats, "g")).toBe(1);
  });

  it("gråmerker ss på melk når bare dl er registrert", () => {
    const milk = food({ name: "Lettmelk", portionLabel: "2 dl", portionGrams: 200 });
    expect(registeredGramsPerUnit(milk, "dl")).toBe(100);
    expect(hasRegisteredUnitWeight(milk, "ss")).toBe(false);
    expect(gramsForIngredientDraft("1", "ss", milk)).toBeNull();
  });

  it("beholder eksisterende enheter når en ny vekt lagres", () => {
    const milk = food({
      name: "Lettmelk",
      portionLabel: "2 dl",
      portionGrams: 200,
      unitGrams: { ts: 5 },
    });
    const next = withRegisteredUnitGrams(milk, "ss", 15);
    expect(next.portionLabel).toBe("2 dl");
    expect(next.portionGrams).toBe(200);
    expect(next.unitGrams).toEqual({ ts: 5, ss: 15 });
    expect(registeredGramsPerUnit(next, "dl")).toBe(100);
    expect(registeredGramsPerUnit(next, "ss")).toBe(15);
  });

  it("slår sammen enhetsvekter uten å slette nøkler", () => {
    expect(mergeUnitGramsMaps({ ss: 15 }, { dl: 100, ss: 12 })).toEqual({ dl: 100, ss: 15 });
  });
});
