import type { MacroSplitPercent, MealPlanTargets } from "./mealPlanTypes";
import { KCAL_PER_G_CARB, KCAL_PER_G_FAT, KCAL_PER_G_PROTEIN } from "./mealPlanTargetBalance";

export type MacroSplitField = keyof MacroSplitPercent;

export const DEFAULT_MACRO_SPLIT: MacroSplitPercent = {
  protein: 30,
  carbs: 40,
  fat: 30,
};

const MACRO_FIELDS: MacroSplitField[] = ["protein", "carbs", "fat"];

/** Protein og karb styres manuelt; fett = resten til 100 %. */
export function residualFatSplit(protein: number, carbs: number): MacroSplitPercent {
  const p = Math.max(0, Math.min(100, Math.round(protein)));
  const c = Math.max(0, Math.min(100 - p, Math.round(carbs)));
  return { protein: p, carbs: c, fat: 100 - p - c };
}

/**
 * Justerer makrofordeling: protein først, deretter karb — fett fyller alltid resten.
 * Protein endres aldri når karb justeres.
 */
export function adjustMacroSplit(
  split: MacroSplitPercent,
  field: MacroSplitField,
  nextValue: number,
): MacroSplitPercent {
  const protein = Math.round(split.protein);
  const carbs = Math.round(split.carbs);
  const clamped = Math.max(0, Math.min(100, Math.round(nextValue)));

  if (field === "protein") {
    const maxProtein = Math.max(0, 100 - carbs);
    return residualFatSplit(Math.min(clamped, maxProtein), carbs);
  }
  if (field === "carbs") {
    const maxCarbs = Math.max(0, 100 - protein);
    return residualFatSplit(protein, Math.min(clamped, maxCarbs));
  }
  return residualFatSplit(protein, carbs);
}

/** Avrunder protein/karb og setter fett som rest. */
export function normalizeMacroSplit(split: MacroSplitPercent): MacroSplitPercent {
  return residualFatSplit(split.protein, split.carbs);
}

export function macroSplitFromTargets(targets: MealPlanTargets): MacroSplitPercent | null {
  const kcal = targets.kcal;
  if (typeof kcal !== "number" || kcal <= 0) return null;

  const pKcal = (targets.protein ?? 0) * KCAL_PER_G_PROTEIN;
  const cKcal = (targets.carbs ?? 0) * KCAL_PER_G_CARB;
  const fKcal = (targets.fat ?? 0) * KCAL_PER_G_FAT;
  const macroKcal = pKcal + cKcal + fKcal;
  if (macroKcal <= 0) return { ...DEFAULT_MACRO_SPLIT };

  const protein = Math.round((pKcal / macroKcal) * 100);
  const carbs = Math.round((cKcal / macroKcal) * 100);
  return residualFatSplit(protein, carbs);
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
  const normalized = normalizeMacroSplit(split);
  const safeKcal = Math.max(0, kcal);
  const pKcal = (safeKcal * normalized.protein) / 100;
  const cKcal = (safeKcal * normalized.carbs) / 100;
  const fKcal = (safeKcal * normalized.fat) / 100;
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
