import { describe, expect, it } from "vitest";
import {
  applyNutritionTargetEdit,
  deriveMacroGrams,
  isIncompleteDecimalString,
  macrosToKcal,
  parseMealPlanTargets,
  proteinGramsFromPerKg,
  redistributeCarbsAndFatForLockedKcal,
} from "./mealPlanTargetBalance";
import { balanceMealPlanTargets } from "./mealPlanTargetBalance";

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

  it("regner protein i gram fra g/kg og vekt", () => {
    expect(proteinGramsFromPerKg(1.6, 72)).toBe(115.2);
  });

  it("fordeler karbo og fett på resterende kcal når kcal er låst", () => {
    const result = redistributeCarbsAndFatForLockedKcal({
      kcal: 2000,
      protein: 150,
    });
    expect(result.warning).toBeNull();
    expect(result.targets.kcal).toBe(2000);
    expect(result.targets.protein).toBe(150);
    expect(macrosToKcal(result.targets)).toBeCloseTo(2000, 0);
    const carbKcal = (result.targets.carbs ?? 0) * 4;
    const fatKcal = (result.targets.fat ?? 0) * 9;
    expect(carbKcal / (carbKcal + fatKcal)).toBeCloseTo(0.6, 1);
  });

  it("beholder karbo/fett-forholdet når protein økes med låst kcal", () => {
    const result = applyNutritionTargetEdit(
      { kcal: 2000, protein: 120, carbs: 200, fat: 71.1, kcalLocked: true },
      "protein",
      "150",
      75,
    );
    expect(result.targets.protein).toBe(150);
    expect(result.targets.kcal).toBe(2000);
    expect(macrosToKcal(result.targets)).toBeCloseTo(2000, 0);
    expect(result.targets.carbs).toBeLessThan(200);
    expect(result.targets.fat).toBeLessThan(71.1);
  });

  it("setter protein i gram fra g/kg", () => {
    const result = applyNutritionTargetEdit({}, "proteinPerKg", "1,8", 80);
    expect(result.targets.proteinPerKg).toBe(1.8);
    expect(result.targets.protein).toBe(144);
  });

  it("setter protein i gram med desimal", () => {
    const result = applyNutritionTargetEdit({}, "protein", "120,5", 80);
    expect(result.targets.protein).toBe(120.5);
    expect(result.targets.proteinPerKg).toBe(1.51);
  });

  it("beholder forrige verdi mens desimaltegn skrives", () => {
    const current = { proteinPerKg: 1.6, protein: 128 };
    expect(isIncompleteDecimalString("1,")).toBe(true);
    expect(isIncompleteDecimalString("1.")).toBe(true);
    expect(isIncompleteDecimalString("1,8")).toBe(false);
    const comma = applyNutritionTargetEdit(current, "proteinPerKg", "1,", 80);
    expect(comma.targets.proteinPerKg).toBe(1.6);
    const period = applyNutritionTargetEdit(current, "proteinPerKg", "1.", 80);
    expect(period.targets.proteinPerKg).toBe(1.6);
  });

  it("parser kcal-lås og g/kg fra JSON", () => {
    const parsed = parseMealPlanTargets({
      kcal: 2100,
      protein: 140,
      proteinPerKg: 1.75,
      kcalLocked: true,
    });
    expect(parsed?.kcalLocked).toBe(true);
    expect(parsed?.proteinPerKg).toBe(1.75);
  });

  it("lagrer planleggingsvekt og oppdaterer protein fra g/kg", () => {
    const withWeight = applyNutritionTargetEdit({ proteinPerKg: 1.6 }, "planningWeightKg", "75", null);
    expect(withWeight.targets.planningWeightKg).toBe(75);
    expect(withWeight.targets.protein).toBe(120);
    const parsed = parseMealPlanTargets({ planningWeightKg: 72.4, proteinPerKg: 1.5 });
    expect(parsed?.planningWeightKg).toBe(72.4);
    expect(parsed?.proteinPerKg).toBe(1.5);
  });

  it("parser lagret mikronæringsanbefaling", () => {
    const parsed = parseMealPlanTargets({
      kcal: 2000,
      nutritionReference: { mode: "custom", ageYears: 42, gender: "male" },
    });
    expect(parsed?.nutritionReference).toEqual({ mode: "custom", ageYears: 42, gender: "male" });
  });
});

