import { EMPTY_FATTY_ACIDS, normalizeFattyAcids, type FoodFattyAcids } from "./foodBankFattyAcids";
import {
  EMPTY_MICRONUTRIENTS,
  FOOD_MICRONUTRIENT_FIELDS,
  type FoodMicronutrientKey,
  type FoodMicronutrients,
} from "./foodBankMicronutrients";
import type { MemberQuickFoodLogEntry } from "./memberMealPlanState";
import { computeMacrosForGrams, EMPTY_MACRO_TOTALS, type MacroTotals } from "./mealPlanMacros";
import { HEALTH_DIRECTORATE_MICRONUTRIENT_DAILY } from "./healthDirectorateNutritionReferences";
import type { MicronutrientReferenceBounds, MicronutrientStatusCode } from "./micronutrientReferenceRanges";
import {
  classifyMicronutrientStatus,
  micronutrientStatusMeta,
  resolveMicronutrientBounds,
} from "./micronutrientReferenceRanges";
import type { NutritionReferenceContext } from "./personalizedNutritionReferences";

export type FoodLogNutritionTotals = MacroTotals & {
  fiber: number;
  sugar: number;
  saturatedFat: number;
  sodium: number;
  fattyAcids: FoodFattyAcids;
  micronutrients: FoodMicronutrients;
};

export const EMPTY_FOOD_LOG_NUTRITION: FoodLogNutritionTotals = {
  ...EMPTY_MACRO_TOTALS,
  fiber: 0,
  sugar: 0,
  saturatedFat: 0,
  sodium: 0,
  fattyAcids: { ...EMPTY_FATTY_ACIDS },
  micronutrients: { ...EMPTY_MICRONUTRIENTS },
};

export type MicronutrientDailyRow = {
  key: FoodMicronutrientKey;
  label: string;
  unit: string;
  decimals: number;
  value: number;
  target: number;
  coveragePct: number;
  lower: number;
  upper: number | null;
  status: MicronutrientStatusCode;
  statusLabel: string;
  statusTone: "danger" | "warn" | "ok" | "muted";
};

export function sumQuickFoodLogNutrition(logs: MemberQuickFoodLogEntry[] | undefined): FoodLogNutritionTotals {
  if (!logs?.length) return { ...EMPTY_FOOD_LOG_NUTRITION, micronutrients: { ...EMPTY_MICRONUTRIENTS } };

  return logs.reduce((acc, entry) => {
    const scale = entry.grams > 0 ? entry.grams / 100 : 0;
    const n = entry.nutritionPer100g;
    const macros = computeMacrosForGrams(n, entry.grams);
    const micros = n.micronutrients ?? EMPTY_MICRONUTRIENTS;
    const fa = normalizeFattyAcids(n.fattyAcids);

    const nextMicros = { ...acc.micronutrients };
    for (const field of FOOD_MICRONUTRIENT_FIELDS) {
      nextMicros[field.key] += (micros[field.key] ?? 0) * scale;
    }

    const nextFa = { ...acc.fattyAcids };
    (Object.keys(nextFa) as Array<keyof FoodFattyAcids>).forEach((key) => {
      nextFa[key] += fa[key] * scale;
    });

    return {
      kcal: acc.kcal + macros.kcal,
      protein: acc.protein + macros.protein,
      carbs: acc.carbs + macros.carbs,
      fat: acc.fat + macros.fat,
      fiber: acc.fiber + n.fiber * scale,
      sugar: acc.sugar + n.sugar * scale,
      saturatedFat: acc.saturatedFat + n.saturatedFat * scale,
      sodium: acc.sodium + n.sodium * scale,
      fattyAcids: nextFa,
      micronutrients: nextMicros,
    };
  }, {
    ...EMPTY_FOOD_LOG_NUTRITION,
    fattyAcids: { ...EMPTY_FATTY_ACIDS },
    micronutrients: { ...EMPTY_MICRONUTRIENTS },
  });
}

export function addFoodLogNutritionTotals(a: FoodLogNutritionTotals, b: FoodLogNutritionTotals): FoodLogNutritionTotals {
  const micronutrients = { ...a.micronutrients };
  for (const field of FOOD_MICRONUTRIENT_FIELDS) {
    micronutrients[field.key] += b.micronutrients[field.key] ?? 0;
  }
  return {
    kcal: a.kcal + b.kcal,
    protein: a.protein + b.protein,
    carbs: a.carbs + b.carbs,
    fat: a.fat + b.fat,
    fiber: a.fiber + b.fiber,
    sugar: a.sugar + b.sugar,
    saturatedFat: a.saturatedFat + b.saturatedFat,
    sodium: a.sodium + b.sodium,
    fattyAcids: (Object.keys(a.fattyAcids) as Array<keyof FoodFattyAcids>).reduce(
      (acc, key) => {
        acc[key] = a.fattyAcids[key] + b.fattyAcids[key];
        return acc;
      },
      { ...EMPTY_FATTY_ACIDS },
    ),
    micronutrients,
  };
}

export function divideFoodLogNutritionTotals(totals: FoodLogNutritionTotals, divisor: number): FoodLogNutritionTotals {
  const safe = divisor > 0 ? divisor : 1;
  const micronutrients = { ...EMPTY_MICRONUTRIENTS };
  for (const field of FOOD_MICRONUTRIENT_FIELDS) {
    micronutrients[field.key] = (totals.micronutrients[field.key] ?? 0) / safe;
  }
  return {
    kcal: totals.kcal / safe,
    protein: totals.protein / safe,
    carbs: totals.carbs / safe,
    fat: totals.fat / safe,
    fiber: totals.fiber / safe,
    sugar: totals.sugar / safe,
    saturatedFat: totals.saturatedFat / safe,
    sodium: totals.sodium / safe,
    fattyAcids: (Object.keys(totals.fattyAcids) as Array<keyof FoodFattyAcids>).reduce(
      (acc, key) => {
        acc[key] = totals.fattyAcids[key] / safe;
        return acc;
      },
      { ...EMPTY_FATTY_ACIDS },
    ),
    micronutrients,
  };
}

export function micronutrientRowsFromLogTotals(
  totals: FoodLogNutritionTotals,
  referenceContext?: NutritionReferenceContext,
): MicronutrientDailyRow[] {
  const dailyTargets = referenceContext?.micronutrientDaily ?? HEALTH_DIRECTORATE_MICRONUTRIENT_DAILY;
  return FOOD_MICRONUTRIENT_FIELDS.map((field) => {
    const value = totals.micronutrients[field.key] ?? 0;
    const bounds: MicronutrientReferenceBounds = referenceContext
      ? resolveMicronutrientBounds(field.key, referenceContext)
      : {
          lower: (dailyTargets[field.key] ?? 0) * 0.8,
          recommended: dailyTargets[field.key] ?? 0,
          upper: null,
        };
    const target = bounds.recommended;
    const coveragePct = target > 0 ? (value / target) * 100 : 0;
    const status = classifyMicronutrientStatus(value, bounds);
    const statusMeta = micronutrientStatusMeta(status);
    return {
      key: field.key,
      label: field.label,
      unit: field.unit,
      decimals: field.decimals,
      value,
      target,
      coveragePct,
      lower: bounds.lower,
      upper: bounds.upper,
      status,
      statusLabel: statusMeta.label,
      statusTone: statusMeta.tone,
    };
  });
}

/** Alle mikronæringsstoffer for rapport — inkl. 0 inntak. */
export function micronutrientRowsForReport(
  totals: FoodLogNutritionTotals,
  referenceContext?: NutritionReferenceContext,
): MicronutrientDailyRow[] {
  return micronutrientRowsFromLogTotals(totals, referenceContext);
}

/** Skjuler rader med status «innenfor anbefalt» (grønn). */
export function filterMicronutrientReportRows(
  rows: MicronutrientDailyRow[],
  issuesOnly: boolean,
): MicronutrientDailyRow[] {
  if (!issuesOnly) return rows;
  return rows.filter((row) => row.statusTone !== "ok");
}
