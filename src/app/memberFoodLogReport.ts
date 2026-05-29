import { formatMacro } from "./foodBankTypes";
import { formatMicronutrientValue } from "./foodBankMicronutrients";
import {
  HEALTH_DIRECTORATE_MICRONUTRIENT_DAILY,
  HEALTH_DIRECTORATE_OTHER_DAILY,
} from "./healthDirectorateNutritionReferences";
import { memberMealSlotLabel } from "./memberMealSlots";
import type { MemberQuickFoodLogEntry } from "./memberMealPlanState";
import {
  micronutrientRowsFromLogTotals,
  sumQuickFoodLogNutrition,
  type FoodLogNutritionTotals,
} from "./quickFoodLogNutrition";

function csvEscape(value: string | number): string {
  const raw = String(value);
  if (/[",\n\r]/.test(raw)) return `"${raw.replace(/"/g, '""')}"`;
  return raw;
}

function csvLine(cells: Array<string | number>): string {
  return cells.map(csvEscape).join(";");
}

function formatDateLabel(dateKey: string): string {
  const parts = dateKey.split("-");
  if (parts.length !== 3) return dateKey;
  return `${parts[2]}.${parts[1]}.${parts[0]}`;
}

export function buildMemberFoodLogCsvReport(options: {
  memberName: string;
  dateKey: string;
  logs: MemberQuickFoodLogEntry[];
  totals?: FoodLogNutritionTotals;
}): string {
  const { memberName, dateKey, logs } = options;
  const totals = options.totals ?? sumQuickFoodLogNutrition(logs);
  const microRows = micronutrientRowsFromLogTotals(totals);
  const lines: string[] = [];

  lines.push(csvLine(["Motus matlogg-rapport"]));
  lines.push(csvLine(["Kunde", memberName]));
  lines.push(csvLine(["Dato", formatDateLabel(dateKey)]));
  lines.push(csvLine(["Generert", new Date().toLocaleString("nb-NO")]));
  lines.push("");

  lines.push(csvLine(["Daglig oppsummering — makro"]));
  lines.push(csvLine(["Næringsstoff", "Inntatt", "Enhet"]));
  lines.push(csvLine(["Kalorier", formatMacro(totals.kcal, 0), "kcal"]));
  lines.push(csvLine(["Protein", formatMacro(totals.protein, 1), "g"]));
  lines.push(csvLine(["Karbohydrater", formatMacro(totals.carbs, 1), "g"]));
  lines.push(csvLine(["Fett", formatMacro(totals.fat, 1), "g"]));
  lines.push(csvLine(["Fiber", formatMacro(totals.fiber, 1), "g"]));
  lines.push(csvLine(["Sukker", formatMacro(totals.sugar, 1), "g"]));
  lines.push(csvLine(["Mettet fett", formatMacro(totals.saturatedFat, 1), "g"]));
  lines.push(csvLine(["Natrium", formatMacro(totals.sodium, 0), "mg"]));
  lines.push("");

  lines.push(csvLine(["Daglig oppsummering — mikro (vs. Helsedirektoratet referanse)"]));
  lines.push(csvLine(["Næringsstoff", "Inntatt", "Referanse", "Enhet", "Dekning %"]));
  for (const row of microRows) {
    if (row.value <= 0 && row.target <= 0) continue;
    lines.push(
      csvLine([
        row.label,
        formatMicronutrientValue(row.value, row.decimals),
        formatMicronutrientValue(row.target, row.decimals),
        row.unit,
        formatMacro(row.coveragePct, 0),
      ]),
    );
  }
  lines.push(
    csvLine([
      "Fiber (referanse)",
      formatMacro(totals.fiber, 1),
      HEALTH_DIRECTORATE_OTHER_DAILY.fiber,
      "g",
      formatMacro((totals.fiber / HEALTH_DIRECTORATE_OTHER_DAILY.fiber) * 100, 0),
    ]),
  );
  lines.push(
    csvLine([
      "Natrium (maks referanse)",
      formatMacro(totals.sodium, 0),
      HEALTH_DIRECTORATE_OTHER_DAILY.sodium,
      "mg",
      formatMacro((totals.sodium / HEALTH_DIRECTORATE_OTHER_DAILY.sodium) * 100, 0),
    ]),
  );
  lines.push("");

  lines.push(csvLine(["Logg per måltid"]));
  lines.push(csvLine(["Måltid", "Matvare", "Gram", "kcal", "Protein g", "Karbo g", "Fett g"]));

  const byMeal = new Map<string, MemberQuickFoodLogEntry[]>();
  for (const entry of logs) {
    const mealKey = entry.mealId?.trim() || "other";
    const list = byMeal.get(mealKey) ?? [];
    list.push(entry);
    byMeal.set(mealKey, list);
  }

  const mealOrder = [...byMeal.keys()].sort((a, b) => {
    const la = memberMealSlotLabel(a);
    const lb = memberMealSlotLabel(b);
    return la.localeCompare(lb, "nb");
  });

  for (const mealKey of mealOrder) {
    for (const entry of byMeal.get(mealKey) ?? []) {
      const scale = entry.grams > 0 ? entry.grams / 100 : 0;
      const n = entry.nutritionPer100g;
      lines.push(
        csvLine([
          memberMealSlotLabel(mealKey),
          entry.name,
          formatMacro(entry.grams, 0),
          formatMacro(n.kcal * scale, 0),
          formatMacro(n.protein * scale, 1),
          formatMacro(n.carbs * scale, 1),
          formatMacro(n.fat * scale, 1),
        ]),
      );
    }
  }

  lines.push("");
  lines.push(
    csvLine([
      "Merknad",
      "Mikronæringsreferanser er generelle voksenverdier (Helsedirektoratet/Matvaretabellen). Manglende mikrodata i matvare gir 0.",
    ]),
  );

  return `${lines.join("\r\n")}\r\n`;
}

export function downloadMemberFoodLogCsv(filename: string, content: string): void {
  const blob = new Blob(["\uFEFF", content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
