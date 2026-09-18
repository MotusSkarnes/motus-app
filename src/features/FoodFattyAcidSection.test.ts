import { describe, expect, it } from "vitest";
import { fattyAcidFormDefaults, fattyAcidFormFromNutrition, parseFattyAcidForm } from "./FoodFattyAcidSection";

describe("fatty acid form empty vs zero", () => {
  it("saves typed values and leaves blank fields unknown", () => {
    const values = { ...fattyAcidFormDefaults(), omega3: "1.2", epa: "0" };
    const parsed = parseFattyAcidForm(values);
    expect(parsed?.omega3).toBe(1.2);
    expect(parsed?.epa).toBe(0);
    expect(parsed?.dha).toBeUndefined();
    expect(parsed?.omega6).toBeUndefined();

    const roundTrip = fattyAcidFormFromNutrition({
      kcal: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
      sugar: 0,
      saturatedFat: 0,
      sodium: 0,
      fattyAcids: parsed,
    });
    expect(roundTrip.omega3).toBe("1.2");
    expect(roundTrip.epa).toBe("0");
    expect(roundTrip.dha).toBe("");
  });

  it("omits fatty acids when every field is blank", () => {
    expect(parseFattyAcidForm(fattyAcidFormDefaults())).toBeUndefined();
  });

  it("treats an all-zero fatty-acid object as unknown on custom foods", () => {
    const roundTrip = fattyAcidFormFromNutrition(
      {
        kcal: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        fiber: 0,
        sugar: 0,
        saturatedFat: 0,
        sodium: 0,
        fattyAcids: {
          monounsaturatedFat: 0,
          polyunsaturatedFat: 0,
          omega3: 0,
          omega6: 0,
          epa: 0,
          dha: 0,
          ala: 0,
        },
      },
      "egen",
    );
    expect(roundTrip.omega3).toBe("");
    expect(roundTrip.epa).toBe("");
    expect(Object.values(roundTrip).every((value) => value === "")).toBe(true);
  });

  it("keeps measured zeros from Matvaretabellen in the form", () => {
    const roundTrip = fattyAcidFormFromNutrition(
      {
        kcal: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        fiber: 0,
        sugar: 0,
        saturatedFat: 0,
        sodium: 0,
        fattyAcids: {
          monounsaturatedFat: 0,
          polyunsaturatedFat: 0,
          omega3: 0,
          omega6: 0,
          epa: 0,
          dha: 0,
          ala: 0,
        },
      },
      "matvaretabell",
    );
    expect(roundTrip.omega3).toBe("0");
    expect(roundTrip.epa).toBe("0");
  });
});
