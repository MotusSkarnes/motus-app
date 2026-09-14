import { formatMacro } from "./foodBankTypes";
import { FOOD_MICRONUTRIENT_FIELDS, type FoodMicronutrientKey } from "./foodBankMicronutrients";
import { totalWaterLiters } from "./nutritionReportDisplay";
import type { FoodLogNutritionTotals } from "./quickFoodLogNutrition";

export type DailyVariationGroupId = "macro" | "micro";
export type DailyVariationTone = "low" | "near" | "high" | "empty";

export type DailyVariationColumn = {
  id: string;
  shortLabel: string;
  label: string;
  unit: string;
  decimals: number;
  read: (totals: FoodLogNutritionTotals) => number;
};

const WEEKDAY_SHORT = ["søn", "man", "tir", "ons", "tor", "fre", "lør"] as const;

function micronutrientColumn(key: FoodMicronutrientKey, shortLabel: string): DailyVariationColumn {
  const field = FOOD_MICRONUTRIENT_FIELDS.find((item) => item.key === key);
  return {
    id: key,
    shortLabel,
    label: field?.label ?? key,
    unit: field?.unit ?? "",
    decimals: field?.decimals ?? 0,
    read: (totals) => Number(totals.micronutrients[key] ?? 0) || 0,
  };
}

export const DAILY_VARIATION_MACRO_COLUMNS: DailyVariationColumn[] = [
  { id: "kcal", shortLabel: "kcal", label: "Kalorier", unit: "kcal", decimals: 0, read: (totals) => totals.kcal },
  { id: "protein", shortLabel: "Prot.", label: "Protein", unit: "g", decimals: 0, read: (totals) => totals.protein },
  { id: "carbs", shortLabel: "Karbo", label: "Karbohydrater", unit: "g", decimals: 0, read: (totals) => totals.carbs },
  { id: "fat", shortLabel: "Fett", label: "Fett", unit: "g", decimals: 0, read: (totals) => totals.fat },
  { id: "fiber", shortLabel: "Fiber", label: "Fiber", unit: "g", decimals: 0, read: (totals) => totals.fiber },
  {
    id: "waterTotal",
    shortLabel: "Vann",
    label: "Vann totalt",
    unit: "L",
    decimals: 1,
    read: (totals) => totalWaterLiters(totals),
  },
];

export const DAILY_VARIATION_MICRO_COLUMNS: DailyVariationColumn[] = [
  micronutrientColumn("vitaminD", "D"),
  micronutrientColumn("vitaminC", "C"),
  micronutrientColumn("folate", "Folat"),
  micronutrientColumn("vitaminB12", "B12"),
  micronutrientColumn("calcium", "Ca"),
  micronutrientColumn("iron", "Fe"),
  micronutrientColumn("magnesium", "Mg"),
  micronutrientColumn("zinc", "Zn"),
];

export function dailyVariationColumns(group: DailyVariationGroupId): DailyVariationColumn[] {
  return group === "micro" ? DAILY_VARIATION_MICRO_COLUMNS : DAILY_VARIATION_MACRO_COLUMNS;
}

export function formatVariationDayLabel(dateKey: string): string {
  const parts = dateKey.split("-").map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) return dateKey;
  const date = new Date(parts[0]!, parts[1]! - 1, parts[2]!);
  const weekday = WEEKDAY_SHORT[date.getDay()] ?? "";
  const day = String(parts[2]!).padStart(2, "0");
  const month = String(parts[1]!).padStart(2, "0");
  return `${weekday} ${day}.${month}`;
}

export function classifyDailyVariation(value: number, average: number): DailyVariationTone {
  if (!(value > 0) && !(average > 0)) return "empty";
  if (!(average > 0)) return value > 0 ? "high" : "empty";
  const ratio = value / average;
  if (ratio < 0.8) return "low";
  if (ratio > 1.2) return "high";
  return "near";
}

export function dailyVariationBarPct(value: number, average: number): number {
  if (!(value > 0)) return 0;
  if (!(average > 0)) return 100;
  return Math.min(100, Math.round((value / (average * 2)) * 100));
}

export function formatDailyVariationValue(value: number, decimals: number): string {
  return formatMacro(value, decimals).replace(".", ",");
}

export type DailyVariationCell = {
  columnId: string;
  value: number;
  display: string;
  tone: DailyVariationTone;
  barPct: number;
};

export type DailyVariationRow = {
  dateKey: string;
  dayLabel: string;
  cells: DailyVariationCell[];
};

export type DailyVariationTable = {
  group: DailyVariationGroupId;
  columns: DailyVariationColumn[];
  rows: DailyVariationRow[];
  averageCells: DailyVariationCell[];
};

function cellFor(column: DailyVariationColumn, value: number, average: number): DailyVariationCell {
  return {
    columnId: column.id,
    value,
    display: formatDailyVariationValue(value, column.decimals),
    tone: classifyDailyVariation(value, average),
    barPct: dailyVariationBarPct(value, average),
  };
}

export function buildDailyVariationTable(
  dailyTotals: Array<{ dateKey: string; totals: FoodLogNutritionTotals }>,
  average: FoodLogNutritionTotals,
  group: DailyVariationGroupId,
  formatDayLabel: (dateKey: string) => string = formatVariationDayLabel,
): DailyVariationTable {
  const columns = dailyVariationColumns(group);
  const averageCells = columns.map((column) => cellFor(column, column.read(average), column.read(average)));
  const rows = dailyTotals.map(({ dateKey, totals }) => ({
    dateKey,
    dayLabel: formatDayLabel(dateKey),
    cells: columns.map((column) => cellFor(column, column.read(totals), column.read(average))),
  }));
  return { group, columns, rows, averageCells };
}
