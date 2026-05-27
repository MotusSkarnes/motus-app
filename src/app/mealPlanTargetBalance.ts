import type { MealPlanTargets } from "./mealPlanTypes";

export const KCAL_PER_G_PROTEIN = 4;
export const KCAL_PER_G_CARB = 4;
export const KCAL_PER_G_FAT = 9;

export type MacroTargetField = "protein" | "carbs" | "fat";

const MACRO_FIELDS: MacroTargetField[] = ["protein", "carbs", "fat"];

function kcalFactor(field: MacroTargetField): number {
  if (field === "protein") return KCAL_PER_G_PROTEIN;
  if (field === "carbs") return KCAL_PER_G_CARB;
  return KCAL_PER_G_FAT;
}

function hasTarget(targets: MealPlanTargets, field: keyof MealPlanTargets): boolean {
  const value = targets[field];
  return typeof value === "number" && Number.isFinite(value);
}

export function macrosToKcal(targets: Pick<MealPlanTargets, MacroTargetField>): number {
  return (
    (targets.protein ?? 0) * KCAL_PER_G_PROTEIN +
    (targets.carbs ?? 0) * KCAL_PER_G_CARB +
    (targets.fat ?? 0) * KCAL_PER_G_FAT
  );
}

/** Hvilken makro som fylles automatisk ut fra kcal og de andre makroene. */
export function pickMacroToDerive(
  targets: MealPlanTargets,
  editedField: keyof MealPlanTargets,
): MacroTargetField | null {
  if (!hasTarget(targets, "kcal")) return null;

  const setMacros = MACRO_FIELDS.filter((field) => hasTarget(targets, field));

  if (setMacros.length === 2) {
    return MACRO_FIELDS.find((field) => !hasTarget(targets, field)) ?? null;
  }

  if (setMacros.length < 2) return null;

  if (editedField === "protein") {
    return hasTarget(targets, "carbs") ? "fat" : hasTarget(targets, "fat") ? "carbs" : "fat";
  }
  if (editedField === "carbs") {
    return hasTarget(targets, "protein") ? "fat" : hasTarget(targets, "fat") ? "protein" : "fat";
  }
  if (editedField === "fat") {
    return hasTarget(targets, "carbs") ? "protein" : hasTarget(targets, "protein") ? "carbs" : "protein";
  }
  if (editedField === "kcal") {
    if (hasTarget(targets, "protein") && hasTarget(targets, "carbs")) return "fat";
    if (hasTarget(targets, "protein") && hasTarget(targets, "fat")) return "carbs";
    if (hasTarget(targets, "carbs") && hasTarget(targets, "fat")) return "protein";
  }

  return null;
}

export function deriveMacroGrams(
  targets: MealPlanTargets,
  field: MacroTargetField,
): number | null {
  const kcal = targets.kcal;
  if (typeof kcal !== "number" || !Number.isFinite(kcal)) return null;

  let usedKcal = 0;
  for (const macro of MACRO_FIELDS) {
    if (macro === field) continue;
    const grams = targets[macro];
    if (typeof grams !== "number" || !Number.isFinite(grams)) return null;
    usedKcal += grams * kcalFactor(macro);
  }

  const remainingKcal = kcal - usedKcal;
  const grams = remainingKcal / kcalFactor(field);
  if (!Number.isFinite(grams)) return null;
  return Math.round(grams * 10) / 10;
}

export type BalancedTargetsResult = {
  targets: MealPlanTargets;
  derivedField: MacroTargetField | null;
  remainingKcal: number | null;
  warning: string | null;
};

/** Fyller inn manglende makro (eller oppdaterer den som skal følge kcal). */
export function balanceMealPlanTargets(
  targets: MealPlanTargets,
  editedField: keyof MealPlanTargets,
): BalancedTargetsResult {
  const next: MealPlanTargets = { ...targets };
  let warning: string | null = null;

  const macroFieldsSet = MACRO_FIELDS.filter((field) => hasTarget(next, field));
  if (!hasTarget(next, "kcal") && macroFieldsSet.length === 3) {
    const sum = macrosToKcal(next);
    next.kcal = Math.round(sum);
    return {
      targets: next,
      derivedField: null,
      remainingKcal: 0,
      warning: null,
    };
  }

  const toDerive = pickMacroToDerive(next, editedField);
  if (!toDerive) {
    return { targets: next, derivedField: null, remainingKcal: null, warning: null };
  }

  const grams = deriveMacroGrams(next, toDerive);
  if (grams === null) {
    return { targets: next, derivedField: null, remainingKcal: null, warning: null };
  }

  if (grams < 0) {
    warning = `Protein, karb og fett overstiger kalorimålet med ${Math.round(Math.abs(grams * kcalFactor(toDerive)))} kcal.`;
    return { targets: next, derivedField: toDerive, remainingKcal: grams * kcalFactor(toDerive), warning };
  }

  next[toDerive] = grams;
  return { targets: next, derivedField: toDerive, remainingKcal: 0, warning: null };
}

const MACRO_LABELS: Record<MacroTargetField, string> = {
  protein: "protein",
  carbs: "karbohydrater",
  fat: "fett",
};

export function describeTargetBalance(
  targets: MealPlanTargets,
  derivedField: MacroTargetField | null,
): string | null {
  if (!hasTarget(targets, "kcal")) return null;

  if (derivedField && hasTarget(targets, derivedField)) {
    const grams = targets[derivedField];
    return `${grams} g ${MACRO_LABELS[derivedField]} er beregnet ut fra kalorimål og de andre makroene (4 kcal/g protein og karb, 9 kcal/g fett).`;
  }

  const toDerive = pickMacroToDerive(targets, "kcal");
  if (!toDerive) return null;

  const preview = deriveMacroGrams(targets, toDerive);
  if (preview === null || preview < 0) return null;

  return `Ca. ${preview} g ${MACRO_LABELS[toDerive]} gjenstår for å nå ${Math.round(targets.kcal!)} kcal.`;
}
