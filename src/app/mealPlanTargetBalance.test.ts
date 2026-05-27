import { describe, expect, it } from "vitest";
import { balanceMealPlanTargets, deriveMacroGrams, macrosToKcal } from "./mealPlanTargetBalance";

describe("mealPlanTargetBalance", () => {
  it("beregner fett fra kcal, protein og karb", () => {
    const result = balanceMealPlanTargets(
      { kcal: 2000, protein: 150, carbs: 200 },
      "carbs",
    );
    expect(result.derivedField).toBe("fat");
    expect(result.targets.fat).toBeCloseTo(66.7, 1);
    expect(macrosToKcal(result.targets)).toBeCloseTo(2000, 0);
  });

  it("beregner protein fra kcal, fett og karb", () => {
    const result = balanceMealPlanTargets(
      { kcal: 2000, fat: 70, carbs: 200 },
      "carbs",
    );
    expect(result.derivedField).toBe("protein");
    expect(result.targets.protein).toBeCloseTo(142.5, 1);
  });

  it("beregner karb fra kcal, protein og fett", () => {
    const result = balanceMealPlanTargets(
      { kcal: 2000, protein: 150, fat: 70 },
      "fat",
    );
    expect(result.derivedField).toBe("carbs");
    expect(result.targets.carbs).toBeCloseTo(192.5, 1);
  });

  it("oppdaterer fett når protein endres og karb er satt", () => {
    const fat = deriveMacroGrams({ kcal: 1800, protein: 120, carbs: 180, fat: 99 }, "fat");
    expect(fat).toBeCloseTo(66.7, 1);
  });

  it("setter kcal fra alle tre makroer", () => {
    const result = balanceMealPlanTargets({ protein: 150, carbs: 200, fat: 65 }, "fat");
    expect(result.targets.kcal).toBe(1985);
  });
});
