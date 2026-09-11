import { formatMacro } from "./foodBankTypes";
import type { NutrientContributionId } from "./nutritionReportContributors";
import {
  gramsFromEnergyPercent,
  HEALTH_DIRECTORATE_MACRO_ENERGY_PERCENT,
  HEALTH_DIRECTORATE_OTHER_DAILY,
} from "./healthDirectorateNutritionReferences";
import type { MealPlanTargets } from "./mealPlanTypes";
import type { NutritionReferenceContext } from "./personalizedNutritionReferences";
import type { FoodLogNutritionTotals } from "./quickFoodLogNutrition";
import { EMPTY_FOOD_LOG_NUTRITION } from "./quickFoodLogNutrition";

export const DEFAULT_DAILY_KCAL_TARGET = HEALTH_DIRECTORATE_OTHER_DAILY.kcalPal16;
/** Anbefalt daglig væske (liter) når kjønn mangler — kvinner 2,0 L (NNR 2023). */
export const DEFAULT_DAILY_WATER_L = HEALTH_DIRECTORATE_OTHER_DAILY.waterLiters;

export function totalWaterLiters(totals: Pick<FoodLogNutritionTotals, "waterLiters" | "drinkWaterLiters">): number {
  return (totals.waterLiters ?? 0) + (totals.drinkWaterLiters ?? 0);
}

export function normalizeFoodLogNutritionTotals(totals: Partial<FoodLogNutritionTotals>): FoodLogNutritionTotals {
  return {
    ...EMPTY_FOOD_LOG_NUTRITION,
    ...totals,
    waterLiters: Number(totals.waterLiters ?? 0) || 0,
    drinkWaterLiters: Number(totals.drinkWaterLiters ?? 0) || 0,
    fattyAcids: { ...EMPTY_FOOD_LOG_NUTRITION.fattyAcids, ...(totals.fattyAcids ?? {}) },
    micronutrients: { ...EMPTY_FOOD_LOG_NUTRITION.micronutrients, ...(totals.micronutrients ?? {}) },
  };
}

export type NutritionReportStatusTone = "danger" | "warn" | "ok" | "muted";
export type MacroDisplayGoal = "min" | "max" | "target" | "range";

export type MacroDisplayRow = {
  id?: NutrientContributionId;
  label: string;
  value: number;
  unit: string;
  target: number;
  decimals: number;
  lower?: number | null;
  upper?: number | null;
  lowerIsBetter?: boolean;
  goal?: MacroDisplayGoal;
};

export type MacroDisplayStatus = {
  tone: NutritionReportStatusTone;
  label: string;
  coveragePct: number;
  barPct: number;
  referenceLine: string;
  percentLine: string;
};

const MACRO_LOW_FRACTION = 0.7;
const MACRO_MAX_WARN_FRACTION = 1.15;
const MACRO_TARGET_OVER_WARN = 1.25;
const MACRO_TARGET_OVER_DANGER = 1.5;
const MACRO_NEAR_UPPER_FRACTION = 0.85;

export function resolveReportKcalTarget(
  targets: MealPlanTargets | null | undefined,
  referenceContext?: Pick<NutritionReferenceContext, "otherDaily">,
): number {
  if (targets?.kcal && targets.kcal > 0) return targets.kcal;
  return referenceContext?.otherDaily.kcalPal16 ?? DEFAULT_DAILY_KCAL_TARGET;
}

export function resolveReportWaterTarget(
  referenceContext?: Pick<NutritionReferenceContext, "otherDaily">,
): number {
  return referenceContext?.otherDaily.waterLiters ?? DEFAULT_DAILY_WATER_L;
}

export function buildWaterReportRows(
  totals: FoodLogNutritionTotals,
  referenceContext?: Pick<NutritionReferenceContext, "otherDaily">,
): MacroDisplayRow[] {
  const normalized = normalizeFoodLogNutritionTotals(totals);
  return [
    {
      id: "waterFromFood",
      label: "Vann (fra mat)",
      value: normalized.waterLiters,
      unit: "L",
      target: 0,
      decimals: 1,
    },
    {
      id: "drinkWater",
      label: "Vann (drikke)",
      value: normalized.drinkWaterLiters,
      unit: "L",
      target: 0,
      decimals: 1,
    },
    {
      id: "waterTotal",
      label: "Vann (totalt)",
      value: totalWaterLiters(normalized),
      unit: "L",
      target: resolveReportWaterTarget(referenceContext),
      decimals: 1,
      goal: "min",
    },
  ];
}

function energyPercentRow(
  id: NutrientContributionId,
  label: string,
  value: number,
  kcal: number,
  spec: { min: number; recommended: number; max: number; kcalPerGram: number },
  mealPlanGrams?: number | null,
): MacroDisplayRow {
  const hasPlan = Boolean(mealPlanGrams && mealPlanGrams > 0);
  return {
    id,
    label,
    value,
    unit: "g",
    decimals: 1,
    lower: hasPlan ? null : gramsFromEnergyPercent(kcal, spec.min, spec.kcalPerGram),
    target: hasPlan ? mealPlanGrams! : gramsFromEnergyPercent(kcal, spec.recommended, spec.kcalPerGram),
    upper: hasPlan ? null : gramsFromEnergyPercent(kcal, spec.max, spec.kcalPerGram),
    goal: hasPlan ? "min" : "range",
  };
}

export function buildMacroDisplayRows(
  totals: FoodLogNutritionTotals,
  targets: MealPlanTargets | null | undefined,
  referenceContext?: Pick<NutritionReferenceContext, "otherDaily">,
): MacroDisplayRow[] {
  const normalized = normalizeFoodLogNutritionTotals(totals);
  const otherDaily = referenceContext?.otherDaily ?? HEALTH_DIRECTORATE_OTHER_DAILY;
  const kcalTarget = resolveReportKcalTarget(targets, referenceContext);
  const sugarMax = gramsFromEnergyPercent(kcalTarget, HEALTH_DIRECTORATE_MACRO_ENERGY_PERCENT.sugarMax, 4);
  const satFatMax = gramsFromEnergyPercent(kcalTarget, HEALTH_DIRECTORATE_MACRO_ENERGY_PERCENT.saturatedFatMax, 9);
  return [
    { id: "kcal", label: "Kalorier", value: normalized.kcal, unit: "kcal", target: kcalTarget, decimals: 0, goal: "target" },
    energyPercentRow(
      "protein",
      "Protein",
      normalized.protein,
      kcalTarget,
      HEALTH_DIRECTORATE_MACRO_ENERGY_PERCENT.protein,
      targets?.protein,
    ),
    energyPercentRow(
      "carbs",
      "Karbohydrater",
      normalized.carbs,
      kcalTarget,
      HEALTH_DIRECTORATE_MACRO_ENERGY_PERCENT.carbs,
      targets?.carbs,
    ),
    energyPercentRow("fat", "Fett", normalized.fat, kcalTarget, HEALTH_DIRECTORATE_MACRO_ENERGY_PERCENT.fat, targets?.fat),
    { id: "fiber", label: "Fiber", value: normalized.fiber, unit: "g", target: otherDaily.fiber, decimals: 1, goal: "min" },
    {
      id: "sugar",
      label: "Sukker",
      value: normalized.sugar,
      unit: "g",
      target: sugarMax,
      decimals: 1,
      lowerIsBetter: true,
      goal: "max",
    },
    {
      id: "saturatedFat",
      label: "Mettet fett",
      value: normalized.saturatedFat,
      unit: "g",
      target: satFatMax,
      decimals: 1,
      lowerIsBetter: true,
      goal: "max",
    },
    {
      id: "sodium",
      label: "Natrium",
      value: normalized.sodium,
      unit: "mg",
      target: otherDaily.sodium,
      decimals: 0,
      lowerIsBetter: true,
      goal: "max",
    },
  ];
}

export function macroCoveragePct(value: number, target: number, lowerIsBetter?: boolean): number {
  if (target <= 0) return 0;
  if (lowerIsBetter) {
    if (value <= target) return 100;
    return Math.max(0, Math.round((target / value) * 100));
  }
  return Math.min(100, Math.round((value / target) * 100));
}

export function formatMacroDisplayValue(row: MacroDisplayRow): string {
  return `${formatMacro(row.value, row.decimals)} ${row.unit}`;
}

export function formatMacroReferenceLine(row: MacroDisplayRow): string {
  const fmt = (value: number) => `${formatMacro(value, row.decimals)} ${row.unit}`;
  const parts: string[] = [];
  if ((row.lower ?? 0) > 0) parts.push(`Min ${fmt(row.lower!)}`);
  if (row.target > 0) {
    const prefix = row.lowerIsBetter || row.goal === "max" ? "Maks" : "Ref.";
    parts.push(`${prefix} ${fmt(row.target)}`);
  }
  if ((row.upper ?? 0) > 0 && row.upper !== row.target) parts.push(`Maks ${fmt(row.upper!)}`);
  return parts.join(" · ") || "Ingen referanse";
}

export function macroDisplayGoal(row: MacroDisplayRow): MacroDisplayGoal {
  if (row.goal) return row.goal;
  if ((row.lower ?? 0) > 0 && (row.upper ?? 0) > 0) return "range";
  return row.lowerIsBetter ? "max" : "min";
}

export function classifyMacroDisplayStatus(row: MacroDisplayRow): MacroDisplayStatus {
  const referenceLine = formatMacroReferenceLine(row);
  if (!(row.target > 0) && !((row.lower ?? 0) > 0) && !((row.upper ?? 0) > 0)) {
    return {
      tone: "muted",
      label: "Ingen referanse",
      coveragePct: 0,
      barPct: 0,
      referenceLine,
      percentLine: "",
    };
  }

  const goal = macroDisplayGoal(row);
  const ratio = row.target > 0 ? row.value / row.target : 0;
  const coveragePct = row.target > 0 ? Math.round(ratio * 100) : 0;
  const barPct = Math.min(100, Math.max(0, coveragePct));

  if (goal === "max") {
    const percentLine = `${coveragePct}% av maks`;
    if (row.value <= row.target) {
      return { tone: "ok", label: "Innenfor anbefalt", coveragePct, barPct, referenceLine, percentLine };
    }
    if (ratio <= MACRO_MAX_WARN_FRACTION) {
      return { tone: "warn", label: "Over anbefalt", coveragePct, barPct: 100, referenceLine, percentLine };
    }
    return { tone: "danger", label: "Over anbefalt", coveragePct, barPct: 100, referenceLine, percentLine };
  }

  if (goal === "range") {
    const lower = row.lower ?? 0;
    const upper = row.upper ?? 0;
    const span = Math.max(upper, row.target, 1);
    const rangeBarPct = Math.min(100, Math.round((row.value / span) * 100));
    const percentLine = `${coveragePct}% av anbefalt`;
    if (lower > 0 && row.value < lower) {
      return { tone: "danger", label: "Under nedre grense", coveragePct, barPct: rangeBarPct, referenceLine, percentLine };
    }
    if (row.value < row.target) {
      return { tone: "warn", label: "Under anbefalt", coveragePct, barPct: rangeBarPct, referenceLine, percentLine };
    }
    if (upper > 0 && row.value > upper) {
      return { tone: "danger", label: "Over øvre grense", coveragePct, barPct: 100, referenceLine, percentLine };
    }
    if (upper > 0 && row.value >= upper * MACRO_NEAR_UPPER_FRACTION) {
      return { tone: "warn", label: "Nær øvre grense", coveragePct, barPct: rangeBarPct, referenceLine, percentLine };
    }
    return { tone: "ok", label: "Innenfor anbefalt", coveragePct, barPct: rangeBarPct, referenceLine, percentLine };
  }

  const percentLine = `${coveragePct}% av anbefalt`;
  if (ratio < MACRO_LOW_FRACTION) {
    return { tone: "danger", label: "Under anbefalt", coveragePct, barPct, referenceLine, percentLine };
  }
  if (ratio < 1) {
    return { tone: "warn", label: "Under anbefalt", coveragePct, barPct, referenceLine, percentLine };
  }
  if (goal === "target" && ratio > MACRO_TARGET_OVER_DANGER) {
    return { tone: "danger", label: "Over anbefalt", coveragePct, barPct: 100, referenceLine, percentLine };
  }
  if (goal === "target" && ratio > MACRO_TARGET_OVER_WARN) {
    return { tone: "warn", label: "Over anbefalt", coveragePct, barPct: 100, referenceLine, percentLine };
  }
  return { tone: "ok", label: "Innenfor anbefalt", coveragePct, barPct: 100, referenceLine, percentLine };
}

export function nutritionMacroReportFootnote(context?: Pick<NutritionReferenceContext, "isPersonalized" | "profileLabel">): string {
  const source = context?.isPersonalized && context.profileLabel
    ? `Helsedirektoratet / NNR 2023 for ${context.profileLabel}`
    : "Helsedirektoratet / NNR 2023";
  return `Kalorier: matplanmål der satt, ellers PAL 1,6. Protein, karbo og fett: matplanmål der satt, ellers anbefalt E%-intervall. Fiber, sukker, mettet fett, natrium og vann: ${source}.`;
}
