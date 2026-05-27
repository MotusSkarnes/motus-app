import { describe, expect, it } from "vitest";
import {
  adjustMacroSplit,
  applyMacroSplitToTargets,
  gramsFromKcalAndSplit,
  macroSplitFromTargets,
  normalizeMacroSplit,
  residualFatSplit,
} from "./mealPlanMacroSplit";
import { macrosToKcal } from "./mealPlanTargetBalance";

describe("mealPlanMacroSplit", () => {
  it("setter fett som rest av protein og karb", () => {
    expect(residualFatSplit(30, 40)).toEqual({ protein: 30, carbs: 40, fat: 30 });
    expect(residualFatSplit(35, 45)).toEqual({ protein: 35, carbs: 45, fat: 20 });
  });

  it("endrer ikke protein når karb økes", () => {
    const next = adjustMacroSplit({ protein: 30, carbs: 40, fat: 30 }, "carbs", 50);
    expect(next.protein).toBe(30);
    expect(next.carbs).toBe(50);
    expect(next.fat).toBe(20);
  });

  it("justerer fett når protein økes, karb uendret", () => {
    const next = adjustMacroSplit({ protein: 30, carbs: 40, fat: 30 }, "protein", 40);
    expect(next.protein).toBe(40);
    expect(next.carbs).toBe(40);
    expect(next.fat).toBe(20);
  });

  it("ignorerer manuell fett-endring og beregner rest", () => {
    const next = adjustMacroSplit({ protein: 30, carbs: 40, fat: 30 }, "fat", 10);
    expect(next).toEqual({ protein: 30, carbs: 40, fat: 30 });
  });

  it("beregner gram fra kcal og prosent", () => {
    const grams = gramsFromKcalAndSplit(2000, { protein: 30, carbs: 40, fat: 30 });
    expect(macrosToKcal(grams)).toBeCloseTo(2000, 0);
  });

  it("oppdaterer mål når prosent endres", () => {
    const targets = applyMacroSplitToTargets({ kcal: 1800 }, { protein: 35, carbs: 45, fat: 99 });
    expect(targets.macroSplitPct).toEqual({ protein: 35, carbs: 45, fat: 20 });
    expect(targets.protein).toBeGreaterThan(0);
  });

  it("normaliserer med fett som rest", () => {
    expect(normalizeMacroSplit({ protein: 33, carbs: 33, fat: 99 })).toEqual({
      protein: 33,
      carbs: 33,
      fat: 34,
    });
  });
});
