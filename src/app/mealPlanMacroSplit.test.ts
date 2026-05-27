import { describe, expect, it } from "vitest";
import {
  adjustMacroSplit,
  applyMacroSplitToTargets,
  gramsFromKcalAndSplit,
  macroSplitFromTargets,
  normalizeMacroSplit,
} from "./mealPlanMacroSplit";
import { macrosToKcal } from "./mealPlanTargetBalance";

describe("mealPlanMacroSplit", () => {
  it("normaliserer til 100 %", () => {
    expect(normalizeMacroSplit({ protein: 33.3, carbs: 33.3, fat: 33.4 })).toEqual({
      protein: 33,
      carbs: 33,
      fat: 34,
    });
  });

  it("fordeler resten proporsjonalt når protein økes", () => {
    const next = adjustMacroSplit({ protein: 30, carbs: 40, fat: 30 }, "protein", 40);
    expect(next.protein).toBe(40);
    expect(next.carbs + next.fat).toBe(60);
    expect(next.carbs).toBeGreaterThan(next.fat);
  });

  it("beregner gram fra kcal og prosent", () => {
    const grams = gramsFromKcalAndSplit(2000, { protein: 30, carbs: 40, fat: 30 });
    expect(macrosToKcal(grams)).toBeCloseTo(2000, 0);
  });

  it("oppdaterer mål når prosent endres", () => {
    const targets = applyMacroSplitToTargets({ kcal: 1800 }, { protein: 35, carbs: 35, fat: 30 });
    expect(targets.protein).toBeGreaterThan(0);
    expect(macroSplitFromTargets(targets)).toEqual({ protein: 35, carbs: 35, fat: 30 });
  });
});
