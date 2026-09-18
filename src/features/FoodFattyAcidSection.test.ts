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
});
