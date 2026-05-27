import type { MacroSplitPercent, MealPlanTargets } from "./mealPlanTypes";
import { KCAL_PER_G_CARB, KCAL_PER_G_FAT, KCAL_PER_G_PROTEIN } from "./mealPlanTargetBalance";

export type MacroSplitField = keyof MacroSplitPercent;

export const DEFAULT_MACRO_SPLIT: MacroSplitPercent = {
  protein: 30,
  carbs: 40,
  fat: 30,
};

const MACRO_FIELDS: MacroSplitField[] = ["protein", "carbs", "fat"];

/** Justerer én andel og fordeler resten proporsjonalt på de to andre — total blir 100. */
export function adjustMacroSplit(
  split: MacroSplitPercent,
  field: MacroSplitField,
  nextValue: number,
): MacroSplitPercent {
  const clamped = Math.max(0, Math.min(100, Math.round(nextValue)));
  const others = MACRO_FIELDS.filter((key) => key !== field);
  const remaining = 100 - clamped;
  const o1 = split[others[0]];
  const o2 = split[others[1]];
  const sumOthers = o1 + o2;

  const draft: MacroSplitPercent = { ...split, [field]: clamped };
  if (sumOthers <= 0) {
    draft[others[0]] = remaining / 2;
    draft[others[1]] = remaining / 2;
  } else {
    draft[others[0]] = (o1 / sumOthers) * remaining;
    draft[others[1]] = (o2 / sumOthers) * remaining;
  }
  return normalizeMacroSplit(draft);
}

/** Avrunder til hele prosent og sikrer at summen er nøyaktig 100. */
export function normalizeMacroSplit(split: MacroSplitPercent): MacroSplitPercent {
  const floors = MACRO_FIELDS.map((field) => ({
    field,
    floor: Math.floor(split[field]),
    frac: split[field] - Math.floor(split[field]),
  }));
  let rounded = floors.map((row) => ({ field: row.field, value: row.floor }));
  let remainder = 100 - rounded.reduce((sum, row) => sum + row.value, 0);

  const order = [...floors].sort((a, b) => b.frac - a.frac);
  for (const row of order) {
    if (remainder <= 0) break;
    const target = rounded.find((item) => item.field === row.field);
    if (target) {
      target.value += 1;
      remainder -= 1;
    }
  }

  return {
    protein: rounded.find((row) => row.field === "protein")!.value,
    carbs: rounded.find((row) => row.field === "carbs")!.value,
    fat: rounded.find((row) => row.field === "fat")!.value,
  };
}

export function macroSplitFromTargets(targets: MealPlanTargets): MacroSplitPercent | null {
  const kcal = targets.kcal;
  if (typeof kcal !== "number" || kcal <= 0) return null;

  const pKcal = (targets.protein ?? 0) * KCAL_PER_G_PROTEIN;
  const cKcal = (targets.carbs ?? 0) * KCAL_PER_G_CARB;
  const fKcal = (targets.fat ?? 0) * KCAL_PER_G_FAT;
  const macroKcal = pKcal + cKcal + fKcal;
  if (macroKcal <= 0) return { ...DEFAULT_MACRO_SPLIT };

  return normalizeMacroSplit({
    protein: (pKcal / macroKcal) * 100,
    carbs: (cKcal / macroKcal) * 100,
    fat: (fKcal / macroKcal) * 100,
  });
}

export function resolveMacroSplit(targets: MealPlanTargets | undefined): MacroSplitPercent {
  const stored = targets?.macroSplitPct;
  if (stored && isValidSplit(stored)) return normalizeMacroSplit(stored);
  const fromGrams = targets ? macroSplitFromTargets(targets) : null;
  if (fromGrams) return fromGrams;
  return { ...DEFAULT_MACRO_SPLIT };
}

function isValidSplit(split: MacroSplitPercent): boolean {
  return MACRO_FIELDS.every((field) => Number.isFinite(split[field]) && split[field] >= 0);
}

export function gramsFromKcalAndSplit(
  kcal: number,
  split: MacroSplitPercent,
): Pick<MealPlanTargets, "protein" | "carbs" | "fat"> {
  const safeKcal = Math.max(0, kcal);
  const pKcal = (safeKcal * split.protein) / 100;
  const cKcal = (safeKcal * split.carbs) / 100;
  const fKcal = (safeKcal * split.fat) / 100;
  return {
    protein: Math.round((pKcal / KCAL_PER_G_PROTEIN) * 10) / 10,
    carbs: Math.round((cKcal / KCAL_PER_G_CARB) * 10) / 10,
    fat: Math.round((fKcal / KCAL_PER_G_FAT) * 10) / 10,
  };
}

export function applyMacroSplitToTargets(
  targets: MealPlanTargets,
  split: MacroSplitPercent,
): MealPlanTargets {
  const normalized = normalizeMacroSplit(split);
  const next: MealPlanTargets = { ...targets, macroSplitPct: normalized };
  if (typeof targets.kcal === "number" && targets.kcal > 0) {
    Object.assign(next, gramsFromKcalAndSplit(targets.kcal, normalized));
  }
  return next;
}

export function formatMacroSplitSummary(split: MacroSplitPercent): string {
  return `P ${split.protein}% · K ${split.carbs}% · F ${split.fat}%`;
}
