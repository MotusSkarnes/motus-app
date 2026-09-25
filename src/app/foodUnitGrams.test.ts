import { describe, expect, it } from "vitest";
import type { FoodItem } from "./foodBankTypes";
import {
  enrichFoodItemUnitGrams,
  gramsForIngredientDraft,
  hasRegisteredUnitWeight,
  inferredUnitGramsFromPortion,
  lookupUnitGramsForFoodName,
  mergeUnitGramsMaps,
  missingRecipeUnitsForFood,
  registeredGramsPerUnit,
  registeredRecipeUnitsForFood,
  unitGramsFromMatvaretabellenPortions,
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

  it("mapper Matvaretabellens husholdningsmål til ss/ts/dl/stk", () => {
    expect(
      unitGramsFromMatvaretabellenPortions([
        { id: "skive", portionName: "skive", quantity: 6, unit: "g" },
        { id: "stk", portionName: "stk", quantity: 325, unit: "g" },
        { id: "dl", portionName: "desiliter", quantity: 55, unit: "g" },
      ]),
    ).toEqual({ skive: 6, stk: 325, dl: 55 });
    expect(
      unitGramsFromMatvaretabellenPortions([
        { id: "stk_stor", portionName: "stk (stor)", quantity: 220, unit: "g" },
        { id: "stk_liten", portionName: "stk (liten)", quantity: 130, unit: "g" },
      ]),
    ).toEqual({ "stk stor": 220, "stk liten": 130 });
    expect(
      unitGramsFromMatvaretabellenPortions([
        { id: "porsjon", portionName: "porsjon", quantity: 150, unit: "g" },
        { id: "pr_skive", portionName: "pr brødskive", quantity: 20, unit: "g" },
      ]),
    ).toEqual({ porsjon: 150, brødskive: 20 });
  });

  it("fyller inn Matvaretabellen-vekter uten å overskrive lagrede enheter", () => {
    expect(lookupUnitGramsForFoodName("Agurk")?.stk).toBe(325);
    expect(lookupUnitGramsForFoodName("Agurk, norsk")?.stk).toBe(325);
    expect(lookupUnitGramsForFoodName("Avokado")?.["stk liten"]).toBe(130);
    expect(lookupUnitGramsForFoodName("Avokado")?.["stk stor"]).toBe(220);
    expect(lookupUnitGramsForFoodName("Havregryn")?.ss).toBe(6);
    expect(lookupUnitGramsForFoodName("Havregryn")?.dl).toBe(40);
    expect(lookupUnitGramsForFoodName("Linfrø, knuste")?.ts).toBe(3);
    const oats = enrichFoodItemUnitGrams(
      food({
        name: "Havregryn",
        source: "matvaretabell",
        portionLabel: "40 g (1 dl)",
        portionGrams: 40,
        unitGrams: { ss: 8 },
      }),
    );
    expect(oats.unitGrams?.ss).toBe(8);
    expect(oats.unitGrams?.dl).toBe(40);
  });

  it("skiller enheter med vekt fra enheter uten vekt", () => {
    const avocado = enrichFoodItemUnitGrams(
      food({ name: "Avokado", source: "matvaretabell", portionLabel: "1/2 stk", portionGrams: 100 }),
    );
    expect(registeredRecipeUnitsForFood(avocado)).toContain("g");
    expect(registeredRecipeUnitsForFood(avocado)).toContain("stk liten");
    expect(registeredRecipeUnitsForFood(avocado)).toContain("stk stor");
    expect(missingRecipeUnitsForFood(avocado)).toContain("ss");
    expect(missingRecipeUnitsForFood(avocado)).not.toContain("g");
    expect(missingRecipeUnitsForFood(avocado)).not.toContain("stk liten");
  });

  it("slår opp enhetsvekter uten å skanne hele tabellen for hvert navn", () => {
    const names = ["Agurk", "Avokado", "Havregryn", "Egg", "Kyllingbryst", "Lettmelk"];
    const started = Date.now();
    for (let index = 0; index < 400; index += 1) {
      for (const name of names) lookupUnitGramsForFoodName(name);
    }
    expect(Date.now() - started).toBeLessThan(200);
  });

  it("gir ikke brød-enheter til brødkrutonger eller andre sammensatte egen-matvarer", () => {
    expect(lookupUnitGramsForFoodName("Brødkrutonger")).toBeUndefined();
    expect(lookupUnitGramsForFoodName("Brød")?.stk).toBe(500);
    const croutons = enrichFoodItemUnitGrams(
      food({
        name: "Brødkrutonger",
        source: "egen",
        isCustom: true,
        unitGrams: { ss: 4, skive: 38, stk: 500 },
      }),
    );
    expect(croutons.unitGrams).toEqual({ ss: 4 });
  });
});
