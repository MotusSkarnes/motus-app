import { EMPTY_FATTY_ACIDS, normalizeFattyAcids } from "./foodBankFattyAcids";
import {
  EMPTY_MICRONUTRIENTS,
  FOOD_MICRONUTRIENT_FIELDS,
  type FoodMicronutrientKey,
} from "./foodBankMicronutrients";
import { normalizeFoodBankNameKey } from "./foodBankNameKey";
import type { FoodItem, FoodNutrition } from "./foodBankTypes";
import { resolveEntryNutritionForTotals, type MealPlanNutritionContext } from "./mealPlanFoodNutrition";
import { computeMacrosForGrams } from "./mealPlanMacros";
import type { MealPlan } from "./mealPlanTypes";
import type { MemberQuickFoodLogEntry } from "./memberMealPlanState";
import { resolveNutritionFromFoodItems } from "./memberNutritionRehydrate";
import { waterLitersFromFoodNutrition, type FoodLogNutritionTotals } from "./quickFoodLogNutrition";

export const DRINK_WATER_CONTRIBUTOR_NAME = "Logget drikke";
export const OTHER_CONTRIBUTOR_NAME = "Øvrige";
export const NUTRIENT_CONTRIBUTION_TOP_N = 3;

export type NutrientContributionId =
  | "kcal"
  | "protein"
  | "carbs"
  | "fat"
  | "fiber"
  | "sugar"
  | "saturatedFat"
  | "sodium"
  | "waterFromFood"
  | "drinkWater"
  | "waterTotal"
  | "monounsaturatedFat"
  | "polyunsaturatedFat"
  | "omega3"
  | "omega6"
  | "epa"
  | "dha"
  | "ala"
  | "epaDha"
  | FoodMicronutrientKey;

export type NutritionContributionSource = {
  id?: string;
  name: string;
  grams: number;
  nutritionPer100g: FoodNutrition;
};

export type NutritionContributor = {
  name: string;
  amount: number;
  percent: number;
};

export type NutrientContributionLookup = Partial<Record<NutrientContributionId, NutritionContributor[]>>;

const MACRO_IDS = [
  "kcal",
  "protein",
  "carbs",
  "fat",
  "fiber",
  "sugar",
  "saturatedFat",
  "sodium",
] as const satisfies NutrientContributionId[];

const FATTY_IDS = [
  "monounsaturatedFat",
  "polyunsaturatedFat",
  "omega3",
  "omega6",
  "epa",
  "dha",
  "ala",
  "epaDha",
] as const satisfies NutrientContributionId[];

const WATER_IDS = ["waterFromFood", "drinkWater", "waterTotal"] as const satisfies NutrientContributionId[];

export const ALL_CONTRIBUTION_IDS: NutrientContributionId[] = [
  ...MACRO_IDS,
  ...WATER_IDS,
  ...FATTY_IDS,
  ...FOOD_MICRONUTRIENT_FIELDS.map((field) => field.key),
];

export function sourceGroupKey(source: NutritionContributionSource): string {
  const nameKey = normalizeFoodBankNameKey(source.name);
  if (nameKey) return `name:${nameKey}`;
  const id = source.id?.trim();
  if (id) return `id:${id}`;
  return `name:${source.name.trim().toLowerCase()}`;
}

function amountForNutrient(source: NutritionContributionSource, id: NutrientContributionId): number {
  const grams = Number(source.grams);
  const scale = Number.isFinite(grams) && grams > 0 ? grams / 100 : 0;
  const n = source.nutritionPer100g;
  const macros = computeMacrosForGrams(n, grams);
  const fa = n.fattyAcids ? normalizeFattyAcids(n.fattyAcids) : EMPTY_FATTY_ACIDS;
  const micros = n.micronutrients ?? EMPTY_MICRONUTRIENTS;

  switch (id) {
    case "kcal":
      return macros.kcal;
    case "protein":
      return macros.protein;
    case "carbs":
      return macros.carbs;
    case "fat":
      return macros.fat;
    case "fiber":
      return (Number(n.fiber) || 0) * scale;
    case "sugar":
      return (Number(n.sugar) || 0) * scale;
    case "saturatedFat":
      return (Number(n.saturatedFat) || 0) * scale;
    case "sodium":
      return (Number(n.sodium) || 0) * scale;
    case "waterFromFood":
    case "waterTotal":
      return waterLitersFromFoodNutrition(n, grams);
    case "drinkWater":
      return 0;
    case "monounsaturatedFat":
      return fa.monounsaturatedFat * scale;
    case "polyunsaturatedFat":
      return fa.polyunsaturatedFat * scale;
    case "omega3":
      return fa.omega3 * scale;
    case "omega6":
      return fa.omega6 * scale;
    case "epa":
      return fa.epa * scale;
    case "dha":
      return fa.dha * scale;
    case "ala":
      return fa.ala * scale;
    case "epaDha":
      return (fa.epa + fa.dha) * scale;
    default:
      return (Number(micros[id]) || 0) * scale;
  }
}

function sharePercent(amount: number, total: number): number {
  if (!(total > 0) || !(amount > 0)) return 0;
  return Math.min(100, Math.round((amount / total) * 100));
}

function nutrientTotalFromReport(totals: FoodLogNutritionTotals, id: NutrientContributionId): number {
  const fa = totals.fattyAcids ?? EMPTY_FATTY_ACIDS;
  switch (id) {
    case "kcal":
      return totals.kcal;
    case "protein":
      return totals.protein;
    case "carbs":
      return totals.carbs;
    case "fat":
      return totals.fat;
    case "fiber":
      return totals.fiber;
    case "sugar":
      return totals.sugar;
    case "saturatedFat":
      return totals.saturatedFat;
    case "sodium":
      return totals.sodium;
    case "waterFromFood":
      return totals.waterLiters;
    case "drinkWater":
      return totals.drinkWaterLiters;
    case "waterTotal":
      return (totals.waterLiters ?? 0) + (totals.drinkWaterLiters ?? 0);
    case "monounsaturatedFat":
      return fa.monounsaturatedFat;
    case "polyunsaturatedFat":
      return fa.polyunsaturatedFat;
    case "omega3":
      return fa.omega3;
    case "omega6":
      return fa.omega6;
    case "epa":
      return fa.epa;
    case "dha":
      return fa.dha;
    case "ala":
      return fa.ala;
    case "epaDha":
      return fa.epa + fa.dha;
    default:
      return totals.micronutrients[id] ?? 0;
  }
}

function rankContributors(
  amounts: Map<string, { name: string; amount: number }>,
  topN: number,
  reportTotal?: number,
): NutritionContributor[] {
  const rows = [...amounts.values()].filter((row) => row.amount > 0);
  if (!rows.length) return [];
  const sourceTotal = rows.reduce((sum, row) => sum + row.amount, 0);
  const total = reportTotal != null && reportTotal > 0 ? reportTotal : sourceTotal;
  const ranked = rows
    .sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name, "nb"))
    .slice(0, topN)
    .map((row) => ({
      name: row.name,
      amount: row.amount,
      percent: sharePercent(row.amount, total),
    }));
  const rankedAmount = ranked.reduce((sum, row) => sum + row.amount, 0);
  const remainingAmount = Math.max(0, total - rankedAmount);
  const remainingPercent = sharePercent(remainingAmount, total);
  if (remainingPercent >= 1) {
    ranked.push({
      name: OTHER_CONTRIBUTOR_NAME,
      amount: remainingAmount,
      percent: remainingPercent,
    });
  }
  return ranked;
}

export function buildNutrientContributionLookup(
  sources: NutritionContributionSource[],
  options?: { drinkWaterLiters?: number; topN?: number; totals?: FoodLogNutritionTotals },
): NutrientContributionLookup {
  const topN = options?.topN ?? NUTRIENT_CONTRIBUTION_TOP_N;
  const grouped = new Map<NutrientContributionId, Map<string, { name: string; amount: number }>>();

  const ensure = (id: NutrientContributionId) => {
    let bySource = grouped.get(id);
    if (!bySource) {
      bySource = new Map();
      grouped.set(id, bySource);
    }
    return bySource;
  };

  const addAmount = (id: NutrientContributionId, key: string, name: string, amount: number) => {
    if (!(amount > 0)) return;
    const bySource = ensure(id);
    const existing = bySource.get(key);
    if (existing) {
      existing.amount += amount;
      if (name.length > existing.name.length) existing.name = name;
      return;
    }
    bySource.set(key, { name, amount });
  };

  for (const source of sources) {
    const name = source.name.trim();
    if (!name || !(source.grams > 0)) continue;
    const key = sourceGroupKey(source);
    for (const id of ALL_CONTRIBUTION_IDS) {
      addAmount(id, key, name, amountForNutrient(source, id));
    }
  }

  const drinkLiters = Number(options?.drinkWaterLiters ?? 0);
  if (drinkLiters > 0) {
    addAmount("drinkWater", "drink", DRINK_WATER_CONTRIBUTOR_NAME, drinkLiters);
    addAmount("waterTotal", "drink", DRINK_WATER_CONTRIBUTOR_NAME, drinkLiters);
  }

  const lookup: NutrientContributionLookup = {};
  for (const [id, amounts] of grouped) {
    const reportTotal = options?.totals ? nutrientTotalFromReport(options.totals, id) : undefined;
    const ranked = rankContributors(amounts, topN, reportTotal);
    if (ranked.length) lookup[id] = ranked;
  }
  return lookup;
}

export function contributorsFor(
  lookup: NutrientContributionLookup | undefined,
  id: NutrientContributionId | undefined,
): NutritionContributor[] {
  if (!lookup || !id) return [];
  return lookup[id] ?? [];
}

/** Short display name: drop Matvaretabellen suffixes, then ellipsis. */
export function shortenFoodName(name: string, maxChars = 16): string {
  const trimmed = name.trim();
  if (!trimmed) return "";
  const head = trimmed.split(",")[0]?.trim() || trimmed;
  if (head.length <= maxChars) return head;
  return `${head.slice(0, Math.max(1, maxChars - 1)).trimEnd()}…`;
}

export function formatContributionPreview(
  contributors: NutritionContributor[],
  maxItems = NUTRIENT_CONTRIBUTION_TOP_N,
): string {
  return contributors
    .filter((row) => row.name !== OTHER_CONTRIBUTOR_NAME)
    .slice(0, maxItems)
    .map((row) => `${shortenFoodName(row.name)} ${row.percent}%`)
    .join(" · ");
}

export function formatContributionPrintLine(contributors: NutritionContributor[]): string {
  return contributors.map((row) => `${row.name} ${row.percent}%`).join(" · ");
}

export function contributionSourcesFromFoodLogs(
  logs: Record<string, MemberQuickFoodLogEntry[] | undefined>,
  dateKeys: string[],
): NutritionContributionSource[] {
  const sources: NutritionContributionSource[] = [];
  for (const dateKey of dateKeys) {
    for (const entry of logs[dateKey] ?? []) {
      const name = entry.name.trim();
      if (!name || !(entry.grams > 0)) continue;
      sources.push({
        id: entry.foodId,
        name,
        grams: entry.grams,
        nutritionPer100g: entry.nutritionPer100g as FoodNutrition,
      });
    }
  }
  return sources;
}

export function contributionSourcesFromMealPlan(
  plan: MealPlan,
  context?: MealPlanNutritionContext,
  dayId?: string,
): NutritionContributionSource[] {
  const sources: NutritionContributionSource[] = [];
  const days = dayId?.trim()
    ? plan.days.filter((day) => day.id === dayId)
    : plan.days;
  for (const day of days) {
    for (const meal of day.meals) {
      for (const item of meal.items) {
        const name = item.foodName.trim();
        if (!name || !(item.grams > 0)) continue;
        sources.push({
          id: item.foodId,
          name,
          grams: item.grams,
          nutritionPer100g: resolveEntryNutritionForTotals(item, context),
        });
      }
    }
  }
  return sources;
}

/** Fyll inn næring fra matbanken (samme oppslag som rapporten), så bidrag matcher det som vises. */
export function resolveFoodLogsNutrition(
  logs: Record<string, MemberQuickFoodLogEntry[] | undefined>,
  dateKeys: string[],
  foodItems: FoodItem[],
): Record<string, MemberQuickFoodLogEntry[]> {
  const next: Record<string, MemberQuickFoodLogEntry[]> = {};
  for (const dateKey of dateKeys) {
    next[dateKey] = (logs[dateKey] ?? []).map((entry) => ({
      ...entry,
      nutritionPer100g: resolveNutritionFromFoodItems(
        entry.name,
        entry.nutritionPer100g,
        foodItems,
        entry.foodId,
      ),
    }));
  }
  return next;
}
