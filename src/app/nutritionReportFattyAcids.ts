import type { FoodFattyAcids } from "./foodBankFattyAcids";
import {
  gramsFromEnergyPercent,
  HEALTH_DIRECTORATE_MACRO_ENERGY_PERCENT,
  HEALTH_DIRECTORATE_OMEGA_REFERENCES,
} from "./healthDirectorateNutritionReferences";
import {
  type MacroDisplayRow,
} from "./nutritionReportDisplay";
import type { FoodLogNutritionTotals } from "./quickFoodLogNutrition";

export type OmegaOverviewRow = MacroDisplayRow;

export function buildExtraFatDisplayRows(totals: FoodLogNutritionTotals, kcalTarget = 0): MacroDisplayRow[] {
  const fa = totals.fattyAcids;
  const mu = HEALTH_DIRECTORATE_MACRO_ENERGY_PERCENT.monounsaturatedFat;
  const pu = HEALTH_DIRECTORATE_MACRO_ENERGY_PERCENT.polyunsaturatedFat;
  return [
    {
      id: "monounsaturatedFat",
      label: "Enumettet fett",
      value: fa.monounsaturatedFat,
      unit: "g",
      decimals: 1,
      lower: gramsFromEnergyPercent(kcalTarget, mu.min, mu.kcalPerGram),
      target: gramsFromEnergyPercent(kcalTarget, mu.recommended, mu.kcalPerGram),
      upper: gramsFromEnergyPercent(kcalTarget, mu.max, mu.kcalPerGram),
      goal: kcalTarget > 0 ? "range" : undefined,
    },
    {
      id: "polyunsaturatedFat",
      label: "Flerumettet fett",
      value: fa.polyunsaturatedFat,
      unit: "g",
      decimals: 1,
      lower: gramsFromEnergyPercent(kcalTarget, pu.min, pu.kcalPerGram),
      target: gramsFromEnergyPercent(kcalTarget, pu.recommended, pu.kcalPerGram),
      upper: gramsFromEnergyPercent(kcalTarget, pu.max, pu.kcalPerGram),
      goal: kcalTarget > 0 ? "range" : undefined,
    },
  ];
}

function minEnergyPercentRow(
  id: MacroDisplayRow["id"],
  label: string,
  value: number,
  kcalTarget: number,
  energyPercent: number,
): OmegaOverviewRow {
  const target = gramsFromEnergyPercent(kcalTarget, energyPercent, HEALTH_DIRECTORATE_OMEGA_REFERENCES.kcalPerGram);
  return {
    id,
    label,
    value,
    unit: "g",
    decimals: 2,
    target,
    goal: target > 0 ? "min" : undefined,
  };
}

export function buildOmegaOverviewRows(fattyAcids: FoodFattyAcids, kcalTarget = 0): OmegaOverviewRow[] {
  const epaDha = fattyAcids.epa + fattyAcids.dha;
  const ratio = fattyAcids.omega3 > 0 ? fattyAcids.omega6 / fattyAcids.omega3 : null;
  const omega = HEALTH_DIRECTORATE_OMEGA_REFERENCES;

  return [
    minEnergyPercentRow("omega3", "Omega-3 totalt", fattyAcids.omega3, kcalTarget, omega.omega3MinEnergyPercent),
    {
      id: "omega6",
      label: "Omega-6 totalt",
      value: fattyAcids.omega6,
      unit: "g",
      decimals: 2,
      target: 0,
    },
    {
      id: "epa",
      label: "EPA",
      value: fattyAcids.epa,
      unit: "g",
      decimals: 2,
      target: 0,
    },
    {
      id: "dha",
      label: "DHA",
      value: fattyAcids.dha,
      unit: "g",
      decimals: 2,
      target: 0,
    },
    minEnergyPercentRow("ala", "ALA (alfa-linolensyre)", fattyAcids.ala, kcalTarget, omega.alaMinEnergyPercent),
    {
      id: "epaDha",
      label: "EPA + DHA",
      value: epaDha,
      unit: "g",
      decimals: 2,
      target: omega.epaDhaGrams,
      goal: "min",
    },
    {
      label: "Forhold omega-6 : omega-3",
      value: ratio ?? 0,
      unit: ":1",
      decimals: 1,
      target: 0,
      displayAsDash: ratio === null,
    },
  ];
}

export function nutritionOmegaReportFootnote(): string {
  return "Omega-3 minst 1 E% og ALA minst 0,5 E% (Helsedirektoratet / NNR 2023). EPA+DHA minst 0,25 g/dag (EFSA). EPA, DHA og omega-6 har ikke egne voksenanbefalinger. NNR setter ikke anbefaling for forholdet omega-6:omega-3.";
}
