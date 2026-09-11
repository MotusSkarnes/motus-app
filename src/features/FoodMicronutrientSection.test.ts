import { describe, expect, it } from "vitest";
import { micronutrientFormDefaults, micronutrientFormFromNutrition, parseMicronutrientForm } from "./FoodMicronutrientSection";

describe("micronutrient form empty vs zero", () => {
  it("saves typed 0 and leaves blank fields unknown", () => {
    const values = { ...micronutrientFormDefaults(), vitaminA: "800", copper: "0" };
    const parsed = parseMicronutrientForm(values);
    expect(parsed.vitaminA).toBe(800);
    expect(parsed.copper).toBe(0);
    expect(parsed.iron).toBeUndefined();

    const roundTrip = micronutrientFormFromNutrition({
      kcal: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
      sugar: 0,
      saturatedFat: 0,
      sodium: 0,
      micronutrients: parsed,
    });
    expect(roundTrip.vitaminA).toBe("800");
    expect(roundTrip.copper).toBe("0");
    expect(roundTrip.iron).toBe("");
  });
});
