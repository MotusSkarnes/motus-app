import { describe, expect, it } from "vitest";
import {
  gramsFromEnergyPercent,
  HEALTH_DIRECTORATE_OTHER_DAILY,
  kcalFromMegajoule,
} from "./healthDirectorateNutritionReferences";
import {
  buildMacroDisplayRows,
  buildWaterReportRows,
  classifyMacroDisplayStatus,
  formatMacroReferenceLine,
} from "./nutritionReportDisplay";
import { resolveNutritionReferenceContext } from "./personalizedNutritionReferences";
import { EMPTY_FOOD_LOG_NUTRITION } from "./quickFoodLogNutrition";

describe("Helsedirektoratet macro references", () => {
  it("uses PAL 1,6 energy for adult women and men", () => {
    expect(kcalFromMegajoule(9.0)).toBe(2151);
    expect(kcalFromMegajoule(11.3)).toBe(2701);
    expect(resolveNutritionReferenceContext("15.03.1990", "female").otherDaily.kcalPal16).toBe(2151);
    expect(resolveNutritionReferenceContext("15.03.1990", "male").otherDaily.kcalPal16).toBe(2701);
  });

  it("uses 25 g fiber / 2.0 L water for women and 35 g / 2.5 L for men", () => {
    const woman = resolveNutritionReferenceContext("15.03.1990", "female").otherDaily;
    const man = resolveNutritionReferenceContext("15.03.1990", "male").otherDaily;
    expect(woman.fiber).toBe(25);
    expect(woman.waterLiters).toBe(2);
    expect(man.fiber).toBe(35);
    expect(man.waterLiters).toBe(2.5);
    expect(woman.sodium).toBe(2300);
  });

  it("builds E% ranges when meal plan macros are missing", () => {
    const rows = buildMacroDisplayRows(EMPTY_FOOD_LOG_NUTRITION, null);
    const protein = rows.find((row) => row.label === "Protein")!;
    const sugar = rows.find((row) => row.label === "Sukker")!;
    const sodium = rows.find((row) => row.label === "Natrium")!;
    expect(protein.goal).toBe("range");
    expect(protein.lower).toBeCloseTo(gramsFromEnergyPercent(HEALTH_DIRECTORATE_OTHER_DAILY.kcalPal16, 10, 4), 5);
    expect(protein.target).toBeCloseTo(gramsFromEnergyPercent(HEALTH_DIRECTORATE_OTHER_DAILY.kcalPal16, 15, 4), 5);
    expect(sugar.goal).toBe("max");
    expect(sugar.target).toBeGreaterThan(0);
    expect(sodium.target).toBe(2300);
    expect(formatMacroReferenceLine(protein)).toContain("Min");
    expect(formatMacroReferenceLine(protein)).toContain("g");
    expect(formatMacroReferenceLine(sugar)).toMatch(/^Maks .+ g$/);
  });

  it("colors water total from Helsedirektoratet AI and leaves drink/food gray", () => {
    const woman = resolveNutritionReferenceContext("15.03.1990", "female");
    const rows = buildWaterReportRows(
      { ...EMPTY_FOOD_LOG_NUTRITION, drinkWaterLiters: 1.2, waterLiters: 0.4 },
      woman,
    );
    expect(classifyMacroDisplayStatus(rows[0]!).tone).toBe("muted");
    expect(classifyMacroDisplayStatus(rows[1]!).tone).toBe("muted");
    expect(rows[2]!.target).toBe(2);
    expect(classifyMacroDisplayStatus(rows[2]!).tone).toBe("warn");
  });

  it("treats sodium over the max as outside recommended", () => {
    const rows = buildMacroDisplayRows({ ...EMPTY_FOOD_LOG_NUTRITION, sodium: 3000 }, null);
    const sodium = rows.find((row) => row.label === "Natrium")!;
    expect(classifyMacroDisplayStatus(sodium).tone).toBe("danger");
  });
});
