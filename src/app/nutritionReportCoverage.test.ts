import { describe, expect, it } from "vitest";
import { EMPTY_MICRONUTRIENTS } from "./foodBankMicronutrients";
import type { FoodNutrition } from "./foodBankTypes";
import { buildNutrientCoverageLookup, formatCoverageTitle, hasKnownNutrientValue } from "./nutritionReportCoverage";

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

describe("nutritionReportCoverage", () => {
  it("counts measured zero as known and omitted copper as unknown", () => {
    const lookup = buildNutrientCoverageLookup([
      {
        name: "Vitaminbamser",
        grams: 1,
        nutritionPer100g: nutrition({ micronutrients: { vitaminA: 800 } }),
      },
      {
        name: "Egg",
        grams: 100,
        nutritionPer100g: nutrition({ micronutrients: { vitaminA: 160, copper: 0 } }),
      },
    ]);

    expect(lookup.vitaminA).toMatchObject({ known: 2, total: 2, percent: 100, missingNames: [] });
    expect(lookup.copper).toMatchObject({
      known: 1,
      total: 2,
      percent: 50,
      missingNames: ["Vitaminbamser"],
    });
  });

  it("does not treat empty micronutrient fill as known copper", () => {
    const source = {
      name: "Vitaminbamser",
      grams: 1,
      nutritionPer100g: nutrition({ micronutrients: { vitaminA: 800 } }),
    };
    expect(hasKnownNutrientValue(source, "vitaminA")).toBe(true);
    expect(hasKnownNutrientValue(source, "copper")).toBe(false);
    expect(hasKnownNutrientValue({ ...source, nutritionPer100g: nutrition({ micronutrients: { copper: 0 } }) }, "copper")).toBe(
      true,
    );
  });

  it("does not treat dense empty zeros as known values", () => {
    const source = {
      name: "Ukjent snacks",
      grams: 20,
      nutritionPer100g: nutrition({ micronutrients: { ...EMPTY_MICRONUTRIENTS } }),
    };
    expect(hasKnownNutrientValue(source, "copper")).toBe(false);
  });

  it("treats explicit zeros on a fully filled custom food as known", () => {
    const lookup = buildNutrientCoverageLookup([
      {
        name: "Vitaminbamser",
        grams: 1,
        nutritionPer100g: nutrition({ micronutrients: { ...EMPTY_MICRONUTRIENTS, vitaminA: 800 } }),
      },
    ]);
    expect(lookup.copper).toMatchObject({ known: 1, total: 1, percent: 100 });
    expect(lookup.vitaminA).toMatchObject({ known: 1, total: 1, percent: 100 });
  });

  it("treats logged drink as fully known and names foods missing water", () => {
    const lookup = buildNutrientCoverageLookup([
      { name: "Agurk", grams: 200, nutritionPer100g: nutrition({ water: 95 }) },
      { name: "Vitaminbamser", grams: 1, nutritionPer100g: nutrition({ kcal: 4 }) },
    ]);
    expect(lookup.drinkWater).toMatchObject({ percent: 100 });
    expect(lookup.waterFromFood).toMatchObject({
      known: 1,
      total: 2,
      percent: 50,
      missingNames: ["Vitaminbamser"],
    });
    expect(lookup.waterTotal?.missingNames).toEqual(["Vitaminbamser"]);
    expect(formatCoverageTitle(lookup.waterFromFood)).toContain("Mangler: Vitaminbamser");
    expect(formatCoverageTitle(lookup.drinkWater)).toContain("Logget drikke");
  });
});
