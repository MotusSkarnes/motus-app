import { describe, expect, it } from "vitest";
import { EMPTY_FATTY_ACIDS } from "./foodBankFattyAcids";
import { gramsFromEnergyPercent } from "./healthDirectorateNutritionReferences";
import { classifyMacroDisplayStatus, formatMacroDisplayValue } from "./nutritionReportDisplay";
import { buildOmegaOverviewRows, nutritionOmegaReportFootnote } from "./nutritionReportFattyAcids";

const KCAL = 2000;

describe("buildOmegaOverviewRows", () => {
  it("uses NNR min energy percent for omega-3 and ALA, and 0.25 g for EPA+DHA", () => {
    const rows = buildOmegaOverviewRows(
      { ...EMPTY_FATTY_ACIDS, omega3: 3, ala: 1.2, epa: 0.2, dha: 0.1, omega6: 6 },
      KCAL,
    );
    const omega3 = rows.find((row) => row.id === "omega3")!;
    const ala = rows.find((row) => row.id === "ala")!;
    const epaDha = rows.find((row) => row.id === "epaDha")!;
    const epa = rows.find((row) => row.id === "epa")!;
    const omega6 = rows.find((row) => row.id === "omega6")!;
    const ratio = rows.find((row) => row.unit === ":1")!;

    expect(omega3.target).toBeCloseTo(gramsFromEnergyPercent(KCAL, 1, 9));
    expect(ala.target).toBeCloseTo(gramsFromEnergyPercent(KCAL, 0.5, 9));
    expect(epaDha.target).toBe(0.25);
    expect(epaDha.value).toBeCloseTo(0.3);
    expect(classifyMacroDisplayStatus(omega3).tone).toBe("ok");
    expect(classifyMacroDisplayStatus(epa).label).toBe("Ingen referanse");
    expect(classifyMacroDisplayStatus(omega6).label).toBe("Ingen referanse");
    expect(ratio.value).toBe(2);
    expect(ratio.displayAsDash).toBeFalsy();
    expect(formatMacroDisplayValue(ratio)).toBe("2.0:1");
    expect(nutritionOmegaReportFootnote()).toContain("NNR 2023");
  });

  it("shows a dash for the omega ratio when omega-3 is missing", () => {
    const ratio = buildOmegaOverviewRows({ ...EMPTY_FATTY_ACIDS, omega6: 4 }, KCAL).find((row) => row.unit === ":1")!;
    expect(ratio.displayAsDash).toBe(true);
    expect(formatMacroDisplayValue(ratio)).toBe("—");
  });
});
