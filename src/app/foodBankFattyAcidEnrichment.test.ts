import { describe, expect, it } from "vitest";
import { EMPTY_FATTY_ACIDS } from "./foodBankFattyAcids";
import { enrichFoodNutritionFattyAcids } from "./foodBankFattyAcidEnrichment";

const BASE = {
  kcal: 400,
  protein: 10,
  carbs: 70,
  fat: 8,
  fiber: 4,
  sugar: 2,
  saturatedFat: 1,
  sodium: 400,
};

describe("enrichFoodNutritionFattyAcids", () => {
  it("does not fill unknown omega values with zero on custom foods", () => {
    const enriched = enrichFoodNutritionFattyAcids(BASE, "Brødkrutonger", "egen");
    expect(enriched.fattyAcids).toBeUndefined();
  });

  it("strips dense all-zero fatty acids on custom foods", () => {
    const enriched = enrichFoodNutritionFattyAcids(
      { ...BASE, fattyAcids: { ...EMPTY_FATTY_ACIDS } },
      "Brødkrutonger",
      "egen",
    );
    expect(enriched.fattyAcids).toBeUndefined();
  });

  it("keeps measured zeros from Matvaretabellen", () => {
    const zeros = { ...EMPTY_FATTY_ACIDS };
    const enriched = enrichFoodNutritionFattyAcids(
      { ...BASE, fattyAcids: zeros },
      "Torsk",
      "matvaretabell",
    );
    expect(enriched.fattyAcids).toEqual(zeros);
  });

  it("keeps a measured zero without filling the other fields", () => {
    const enriched = enrichFoodNutritionFattyAcids({ ...BASE, fattyAcids: { omega3: 0 } }, "Brødkrutonger", "egen");
    expect(enriched.fattyAcids).toEqual({ omega3: 0 });
  });
});
