import { formatMacro } from "./foodBankTypes";
import type { FoodFattyAcids } from "./foodBankFattyAcids";
import type { MacroDisplayRow } from "./nutritionReportDisplay";
import type { FoodLogNutritionTotals } from "./quickFoodLogNutrition";

export type OmegaOverviewRow = {
  label: string;
  value: number;
  unit: string;
  decimals: number;
  hint?: string;
  /** Vis «—» i stedet for tall (f.eks. når forhold ikke kan beregnes). */
  displayAsDash?: boolean;
};

/** Daglige referanser (veiledende for voksne). */
export const OMEGA3_DAILY_TARGET_G = 2;
export const EPA_DHA_DAILY_TARGET_G = 0.25;

export function buildExtraFatDisplayRows(totals: FoodLogNutritionTotals): MacroDisplayRow[] {
  const fa = totals.fattyAcids;
  return [
    {
      label: "Enumettet fett",
      value: fa.monounsaturatedFat,
      unit: "g",
      target: 0,
      decimals: 1,
    },
    {
      label: "Flerumettet fett",
      value: fa.polyunsaturatedFat,
      unit: "g",
      target: 0,
      decimals: 1,
    },
  ];
}

export function buildOmegaOverviewRows(fattyAcids: FoodFattyAcids): OmegaOverviewRow[] {
  const epaDha = fattyAcids.epa + fattyAcids.dha;
  const ratio =
    fattyAcids.omega3 > 0 ? fattyAcids.omega6 / fattyAcids.omega3 : null;

  return [
    { label: "Omega-3 totalt", value: fattyAcids.omega3, unit: "g", decimals: 2 },
    { label: "Omega-6 totalt", value: fattyAcids.omega6, unit: "g", decimals: 2 },
    { label: "EPA", value: fattyAcids.epa, unit: "g", decimals: 2 },
    { label: "DHA", value: fattyAcids.dha, unit: "g", decimals: 2 },
    { label: "ALA (alfa-linolensyre)", value: fattyAcids.ala, unit: "g", decimals: 2 },
    { label: "EPA + DHA", value: epaDha, unit: "g", decimals: 2 },
    {
      label: "Forhold omega-6 : omega-3",
      value: ratio ?? 0,
      unit: ":1",
      decimals: 1,
      displayAsDash: ratio === null,
      hint:
        ratio === null
          ? "Kan ikke beregnes uten omega-3"
          : ratio <= 5
            ? "Under 5:1 regnes ofte gunstig"
            : "Høyt forhold — mer omega-3 kan være gunstig",
    },
  ];
}

export function formatOmegaOverviewValue(row: OmegaOverviewRow): string {
  if (row.displayAsDash) return "—";
  if (row.unit === ":1") return `${formatMacro(row.value, row.decimals)}${row.unit}`;
  return `${formatMacro(row.value, row.decimals)} ${row.unit}`;
}
