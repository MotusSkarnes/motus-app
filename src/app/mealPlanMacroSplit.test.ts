import { describe, expect, it } from "vitest";
import {
  adjustMacroSplit,
  applyMacroSplitToTargets,
  gramsFromKcalAndSplit,
  isMacroFieldDerived,
  macroSplitFromTargets,
  normalizeMacroSplit,
  normalizeMacroSplitLocks,
  residualFatSplit,
  toggleMacroSplitLock,
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

  it("ignorerer manuell fett-endring uten lås", () => {
    const next = adjustMacroSplit({ protein: 30, carbs: 40, fat: 30 }, "fat", 10);
    expect(next).toEqual({ protein: 30, carbs: 40, fat: 30 });
  });

  it("holder låst protein når karb endres", () => {
    const locks = ["protein"] as const;
    const next = adjustMacroSplit({ protein: 35, carbs: 40, fat: 25 }, "carbs", 50, [...locks]);
    expect(next.protein).toBe(35);
    expect(next.carbs).toBe(50);
    expect(next.fat).toBe(15);
  });

  it("lar låst fett endres manuelt", () => {
    const locks = ["fat"] as const;
    const next = adjustMacroSplit({ protein: 30, carbs: 40, fat: 30 }, "fat", 25, [...locks]);
    expect(next.fat).toBe(25);
    expect(next.protein + next.carbs + next.fat).toBe(100);
  });

  it("beregner rest når to makroer er låst", () => {
    const locks = ["protein", "carbs"] as const;
    expect(isMacroFieldDerived("fat", [...locks])).toBe(true);
    expect(normalizeMacroSplit({ protein: 40, carbs: 35, fat: 99 }, [...locks])).toEqual({
      protein: 40,
      carbs: 35,
      fat: 25,
    });
  });

  it("tillater maks to låste makroer", () => {
    expect(toggleMacroSplitLock([], "protein")).toEqual(["protein"]);
    expect(toggleMacroSplitLock(["protein"], "carbs")).toEqual(["protein", "carbs"]);
    expect(toggleMacroSplitLock(["protein", "carbs"], "fat")).toEqual(["protein", "carbs"]);
    expect(toggleMacroSplitLock(["protein", "carbs"], "protein")).toEqual(["carbs"]);
    expect(normalizeMacroSplitLocks(["protein", "carbs", "fat", "protein"])).toEqual(["protein", "carbs"]);
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

  it("normaliserer med fett som rest uten lås", () => {
    expect(normalizeMacroSplit({ protein: 33, carbs: 33, fat: 99 })).toEqual({
      protein: 33,
      carbs: 33,
      fat: 34,
    });
  });

  it("lagrer låste makroer på mål", () => {
    const targets = applyMacroSplitToTargets(
      { kcal: 2000, macroSplitLocked: ["protein"] },
      { protein: 40, carbs: 40, fat: 20 },
    );
    expect(targets.macroSplitLocked).toEqual(["protein"]);
    expect(targets.macroSplitPct?.protein).toBe(40);
  });

  it("deriverer prosent fra gram", () => {
    const split = macroSplitFromTargets({ kcal: 2000, protein: 150, carbs: 200, fat: 67 });
    expect(split).toBeTruthy();
    expect(split!.protein + split!.carbs + split!.fat).toBe(100);
  });
});
