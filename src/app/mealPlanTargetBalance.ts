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

export type NutritionTargetEditField = MacroTargetField | "kcal" | "proteinPerKg" | "kcalLocked";

function roundGrams(n: number): number {
  return Math.round(n * 10) / 10;
}

function roundPerKg(n: number): number {
  return Math.round(n * 100) / 100;
}

export function proteinGramsFromPerKg(perKg: number, weightKg: number): number {
  return roundGrams(perKg * weightKg);
}

export function proteinPerKgFromGrams(grams: number, weightKg: number): number {
  if (!(weightKg > 0)) return 0;
  return roundPerKg(grams / weightKg);
}

export function parseMealPlanTargets(value: unknown): MealPlanTargets | undefined {
  if (!value || typeof value !== "object") return undefined;
  const row = value as Record<string, unknown>;
  const targets: MealPlanTargets = {};
  if (typeof row.kcal === "number" && Number.isFinite(row.kcal)) targets.kcal = row.kcal;
  if (typeof row.protein === "number" && Number.isFinite(row.protein)) targets.protein = row.protein;
  if (typeof row.carbs === "number" && Number.isFinite(row.carbs)) targets.carbs = row.carbs;
  if (typeof row.fat === "number" && Number.isFinite(row.fat)) targets.fat = row.fat;
  if (typeof row.proteinPerKg === "number" && Number.isFinite(row.proteinPerKg) && row.proteinPerKg > 0) {
    targets.proteinPerKg = row.proteinPerKg;
  } else {
    const snake = row.protein_per_kg;
    if (typeof snake === "number" && Number.isFinite(snake) && snake > 0) targets.proteinPerKg = snake;
  }
  if (row.kcalLocked === true || row.kcal_locked === true) targets.kcalLocked = true;
  const split = row.macroSplitPct ?? row.macro_split_pct;
  if (split && typeof split === "object") {
    const s = split as Record<string, unknown>;
    const protein = Number(s.protein);
    const carbs = Number(s.carbs);
    const fat = Number(s.fat);
    if ([protein, carbs, fat].every((n) => Number.isFinite(n))) {
      targets.macroSplitPct = { protein, carbs, fat };
    }
  }
  const lockedRaw = row.macroSplitLocked ?? row.macro_split_locked;
  if (Array.isArray(lockedRaw)) {
    const allowed = new Set(["protein", "carbs", "fat"]);
    const locked = lockedRaw
      .map((v) => String(v))
      .filter((v): v is "protein" | "carbs" | "fat" => allowed.has(v));
    if (locked.length) targets.macroSplitLocked = locked.slice(0, 2);
  }
  const updatedAt = Number(row.updatedAt ?? row.updated_at);
  if (Number.isFinite(updatedAt) && updatedAt > 0) targets.updatedAt = updatedAt;
  return Object.keys(targets).length ? targets : undefined;
}

export function mealPlanTargetsHaveValues(targets?: MealPlanTargets | null): boolean {
  if (!targets) return false;
  return (
    (typeof targets.kcal === "number" && Number.isFinite(targets.kcal)) ||
    (typeof targets.protein === "number" && Number.isFinite(targets.protein)) ||
    (typeof targets.carbs === "number" && Number.isFinite(targets.carbs)) ||
    (typeof targets.fat === "number" && Number.isFinite(targets.fat)) ||
    (typeof targets.proteinPerKg === "number" && Number.isFinite(targets.proteinPerKg) && targets.proteinPerKg > 0)
  );
}

const DEFAULT_REMAINING_CARB_SHARE = 0.6;

/** Holder kcal fast og fordeler resten mellom karbo og fett etter protein. */
export function redistributeCarbsAndFatForLockedKcal(targets: MealPlanTargets): BalancedTargetsResult {
  const next: MealPlanTargets = { ...targets, kcalLocked: true };
  if (!hasTarget(next, "kcal") || !hasTarget(next, "protein")) {
    return { targets: next, derivedField: null, remainingKcal: null, warning: null };
  }

  const remainingKcal = next.kcal! - next.protein! * KCAL_PER_G_PROTEIN;
  if (remainingKcal < 0) {
    return {
      targets: next,
      derivedField: "carbs",
      remainingKcal,
      warning: `Protein overstiger kalorimålet med ${Math.round(Math.abs(remainingKcal))} kcal.`,
    };
  }

  const hasCarbs = hasTarget(next, "carbs");
  const hasFat = hasTarget(next, "fat");

  if (hasCarbs && !hasFat) {
    const fatGrams = deriveMacroGrams(next, "fat");
    if (fatGrams === null) return { targets: next, derivedField: null, remainingKcal: null, warning: null };
    if (fatGrams < 0) {
      return {
        targets: next,
        derivedField: "fat",
        remainingKcal: fatGrams * KCAL_PER_G_FAT,
        warning: `Protein og karbohydrater overstiger kalorimålet med ${Math.round(Math.abs(fatGrams * KCAL_PER_G_FAT))} kcal.`,
      };
    }
    next.fat = fatGrams;
    return { targets: next, derivedField: "fat", remainingKcal: 0, warning: null };
  }

  if (hasFat && !hasCarbs) {
    const carbGrams = deriveMacroGrams(next, "carbs");
    if (carbGrams === null) return { targets: next, derivedField: null, remainingKcal: null, warning: null };
    if (carbGrams < 0) {
      return {
        targets: next,
        derivedField: "carbs",
        remainingKcal: carbGrams * KCAL_PER_G_CARB,
        warning: `Protein og fett overstiger kalorimålet med ${Math.round(Math.abs(carbGrams * KCAL_PER_G_CARB))} kcal.`,
      };
    }
    next.carbs = carbGrams;
    return { targets: next, derivedField: "carbs", remainingKcal: 0, warning: null };
  }

  const carbKcal = (next.carbs ?? 0) * KCAL_PER_G_CARB;
  const fatKcal = (next.fat ?? 0) * KCAL_PER_G_FAT;
  const existing = carbKcal + fatKcal;
  const carbShare = existing > 0 ? carbKcal / existing : DEFAULT_REMAINING_CARB_SHARE;
  next.carbs = roundGrams((remainingKcal * carbShare) / KCAL_PER_G_CARB);
  next.fat = roundGrams((remainingKcal * (1 - carbShare)) / KCAL_PER_G_FAT);
  return { targets: next, derivedField: null, remainingKcal: 0, warning: null };
}

function parseOptionalNumber(value: string): number | undefined | "invalid" {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed.replace(",", "."));
  if (!Number.isFinite(parsed) || parsed < 0) return "invalid";
  return parsed;
}

/** Oppdater ett målfelt, med g/kg-protein og valgfri kcal-lås. */
export function applyNutritionTargetEdit(
  current: MealPlanTargets,
  field: NutritionTargetEditField,
  rawValue: string | boolean,
  bodyWeightKg: number | null,
): BalancedTargetsResult {
  const next: MealPlanTargets = { ...current };

  if (field === "kcalLocked") {
    next.kcalLocked = rawValue === true;
    if (!next.kcalLocked) {
      return { targets: next, derivedField: null, remainingKcal: null, warning: null };
    }
    return redistributeCarbsAndFatForLockedKcal(next);
  }

  const parsed = parseOptionalNumber(String(rawValue ?? ""));
  if (parsed === "invalid") {
    return { targets: current, derivedField: null, remainingKcal: null, warning: null };
  }

  if (parsed === undefined) {
    if (field === "protein") {
      delete next.protein;
      delete next.proteinPerKg;
    } else if (field === "proteinPerKg") {
      delete next.proteinPerKg;
    } else if (field === "kcal") {
      delete next.kcal;
    } else if (field === "carbs") {
      delete next.carbs;
    } else if (field === "fat") {
      delete next.fat;
    }
    return { targets: next, derivedField: null, remainingKcal: null, warning: null };
  }

  if (field === "kcal") {
    next.kcal = Math.round(parsed);
  } else if (field === "protein") {
    next.protein = parsed;
    if (bodyWeightKg && bodyWeightKg > 0) {
      next.proteinPerKg = proteinPerKgFromGrams(parsed, bodyWeightKg);
    }
  } else if (field === "proteinPerKg") {
    next.proteinPerKg = roundPerKg(parsed);
    if (bodyWeightKg && bodyWeightKg > 0) {
      next.protein = proteinGramsFromPerKg(next.proteinPerKg, bodyWeightKg);
    }
  } else if (field === "carbs") {
    next.carbs = parsed;
  } else if (field === "fat") {
    next.fat = parsed;
  }

  if (next.kcalLocked) {
    if (field === "protein" || field === "proteinPerKg" || field === "kcal") {
      return redistributeCarbsAndFatForLockedKcal(next);
    }
    const toDerive: MacroTargetField = field === "carbs" ? "fat" : "carbs";
    if (hasTarget(next, "kcal") && hasTarget(next, "protein")) {
      const grams = deriveMacroGrams(next, toDerive);
      if (grams === null) {
        return { targets: next, derivedField: null, remainingKcal: null, warning: null };
      }
      if (grams < 0) {
        const factor = toDerive === "fat" ? KCAL_PER_G_FAT : KCAL_PER_G_CARB;
        return {
          targets: next,
          derivedField: toDerive,
          remainingKcal: grams * factor,
          warning: `Protein og ${field === "carbs" ? "karbohydrater" : "fett"} overstiger kalorimålet med ${Math.round(Math.abs(grams * factor))} kcal.`,
        };
      }
      next[toDerive] = grams;
      return { targets: next, derivedField: toDerive, remainingKcal: 0, warning: null };
    }
    return { targets: next, derivedField: null, remainingKcal: null, warning: null };
  }

  const balanceField: keyof MealPlanTargets = field === "proteinPerKg" ? "protein" : field;
  return balanceMealPlanTargets(next, balanceField);
}

export function describeTargetBalance(
  targets: MealPlanTargets,
  derivedField: MacroTargetField | null,
): string | null {
  if (!hasTarget(targets, "kcal")) return null;

  if (targets.kcalLocked && hasTarget(targets, "protein") && hasTarget(targets, "carbs") && hasTarget(targets, "fat")) {
    return null;
  }

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
