import type { MemberQuickFoodLogEntry } from "./memberMealPlanState";
import {
  addFoodLogNutritionTotals,
  divideFoodLogNutritionTotals,
  EMPTY_FOOD_LOG_NUTRITION,
  sumQuickFoodLogNutrition,
  type FoodLogNutritionTotals,
} from "./quickFoodLogNutrition";

export type MemberFoodLogNutritionPeriodReport = {
  dateKeys: string[];
  daysWithLogs: number;
  dailyTotals: Array<{ dateKey: string; totals: FoodLogNutritionTotals }>;
  periodSum: FoodLogNutritionTotals;
  dailyAverage: FoodLogNutritionTotals;
};

export function dateKeysWithLogs(
  quickFoodLogs: Record<string, MemberQuickFoodLogEntry[] | undefined>,
): string[] {
  return Object.keys(quickFoodLogs)
    .filter((key) => (quickFoodLogs[key]?.length ?? 0) > 0)
    .sort((a, b) => b.localeCompare(a));
}

export function filterDateKeysInRange(dateKeys: string[], fromKey: string, toKey: string): string[] {
  const from = fromKey.trim();
  const to = toKey.trim();
  if (!from || !to) return dateKeys;
  const low = from <= to ? from : to;
  const high = from <= to ? to : from;
  return dateKeys.filter((key) => key >= low && key <= high).sort((a, b) => a.localeCompare(b));
}

export function lastNDaysDateKeys(dateKeys: string[], anchorDateKey: string, days: number): string[] {
  if (!dateKeys.length || days <= 0) return [];
  const anchor = anchorDateKey.trim();
  const sortedAsc = [...dateKeys].sort((a, b) => a.localeCompare(b));
  const upToAnchor = sortedAsc.filter((key) => key <= anchor);
  return upToAnchor.slice(-days);
}

export function buildMemberFoodLogNutritionPeriodReport(
  quickFoodLogs: Record<string, MemberQuickFoodLogEntry[] | undefined>,
  dateKeys: string[],
): MemberFoodLogNutritionPeriodReport {
  const keys = dateKeys.filter((key) => (quickFoodLogs[key]?.length ?? 0) > 0);
  let periodSum = { ...EMPTY_FOOD_LOG_NUTRITION };
  const dailyTotals: MemberFoodLogNutritionPeriodReport["dailyTotals"] = [];

  for (const dateKey of keys) {
    const totals = sumQuickFoodLogNutrition(quickFoodLogs[dateKey]);
    dailyTotals.push({ dateKey, totals });
    periodSum = addFoodLogNutritionTotals(periodSum, totals);
  }

  const daysWithLogs = keys.length;
  const dailyAverage = divideFoodLogNutritionTotals(periodSum, daysWithLogs);

  return {
    dateKeys: keys,
    daysWithLogs,
    dailyTotals,
    periodSum,
    dailyAverage,
  };
}

export function formatPeriodLabel(dateKeys: string[]): string {
  if (!dateKeys.length) return "Ingen dager";
  const sorted = [...dateKeys].sort((a, b) => a.localeCompare(b));
  const first = formatShortDateKey(sorted[0]!);
  const last = formatShortDateKey(sorted[sorted.length - 1]!);
  if (first === last) return first;
  return `${first} – ${last}`;
}

export function formatShortDateKey(dateKey: string): string {
  const parts = dateKey.split("-");
  if (parts.length !== 3) return dateKey;
  return `${parts[2]}.${parts[1]}.${parts[0]}`;
}
