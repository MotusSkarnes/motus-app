import { describe, expect, it } from "vitest";
import {
  convertNutrientAmount,
  micronutrientsFromMatvaretabellen,
  normalizeMicronutrients,
  parseMatvaretabellenConstituent,
} from "./foodBankMicronutrients";
import { mapMatvaretabellenFood } from "./foodBankImport";

describe("foodBankMicronutrients", () => {
  it("converts mg to µg for vitamins", () => {
    expect(convertNutrientAmount(1.5, "mg", "µg")).toBe(1500);
  });

  it("reads matvaretabellen constituents into micronutrients", () => {
    const micro = micronutrientsFromMatvaretabellen([
      { nutrientId: "Vit C", quantity: 12.5, unit: "mg" },
      { nutrientId: "Ca", quantity: 45, unit: "mg" },
      { nutrientId: "Fe", quantity: 2.1, unit: "mg" },
      { nutrientId: "I", quantity: 30, unit: "µg" },
    ]);
    expect(micro.vitaminC).toBe(12.5);
    expect(micro.calcium).toBe(45);
    expect(micro.iron).toBe(2.1);
    expect(micro.iodine).toBe(30);
  });

  it("parses sodium in mg from matvaretabellen", () => {
    expect(
      parseMatvaretabellenConstituent([{ nutrientId: "Na", quantity: 74, unit: "mg" }], "Na", "mg"),
    ).toBe(74);
  });

  it("fills missing micronutrients with zero", () => {
    expect(normalizeMicronutrients({ vitaminC: 5 }).vitaminC).toBe(5);
    expect(normalizeMicronutrients({ vitaminC: 5 }).iron).toBe(0);
  });
});

describe("mapMatvaretabellenFood micronutrients", () => {
  it("includes micronutrients on imported foods", () => {
    const item = mapMatvaretabellenFood(
      {
        foodName: "Spinat",
        foodGroupId: "6.1",
        calories: { quantity: 23 },
        constituents: [
          { nutrientId: "Protein", quantity: 2.9, unit: "g" },
          { nutrientId: "Karbo", quantity: 3.6, unit: "g" },
          { nutrientId: "Fett", quantity: 0.4, unit: "g" },
          { nutrientId: "Vit C", quantity: 28, unit: "mg" },
          { nutrientId: "Fe", quantity: 2.7, unit: "mg" },
        ],
      },
      "PT Test",
    );
    expect(item?.nutritionPer100g.micronutrients?.vitaminC).toBe(28);
    expect(item?.nutritionPer100g.micronutrients?.iron).toBe(2.7);
  });
});
