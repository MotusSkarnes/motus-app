import type { MacroSplitPercent, MealPlanTargets } from "./mealPlanTypes";
import { KCAL_PER_G_CARB, KCAL_PER_G_FAT, KCAL_PER_G_PROTEIN } from "./mealPlanTargetBalance";

export type MacroSplitField = keyof MacroSplitPercent;

export const DEFAULT_MACRO_SPLIT: MacroSplitPercent = {
  protein: 30,
  carbs: 40,
  fat: 30,
};

export const MAX_MACRO_SPLIT_LOCKS = 2;

const MACRO_FIELDS: MacroSplitField[] = ["protein", "carbs", "fat"];

function clampPct(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Protein og karb styres manuelt; fett = resten til 100 %. */
export function residualFatSplit(protein: number, carbs: number): MacroSplitPercent {
  const p = clampPct(protein);
  const c = clampPct(Math.min(carbs, 100 - p));
  return { protein: p, carbs: c, fat: 100 - p - c };
}

export function normalizeMacroSplitLocks(locks: MacroSplitField[] | undefined): MacroSplitField[] {
  if (!locks?.length) return [];
  const seen = new Set<MacroSplitField>();
  const result: MacroSplitField[] = [];
  for (const field of locks) {
    if (!MACRO_FIELDS.includes(field) || seen.has(field)) continue;
    seen.add(field);
    result.push(field);
    if (result.length >= MAX_MACRO_SPLIT_LOCKS) break;
  }
  return result;
}

export function isMacroFieldLocked(field: MacroSplitField, locks: MacroSplitField[] | undefined): boolean {
  return normalizeMacroSplitLocks(locks).includes(field);
}

/** Felt som beregnes automatisk (ikke redigerbart). */
export function isMacroFieldDerived(field: MacroSplitField, locks: MacroSplitField[] | undefined): boolean {
  const normalized = normalizeMacroSplitLocks(locks);
  if (normalized.length === 2) {
    return !normalized.includes(field);
  }
  if (normalized.length === 0) {
    return field === "fat";
  }
  return false;
}

export function canToggleMacroSplitLock(
  field: MacroSplitField,
  locks: MacroSplitField[] | undefined,
): boolean {
  const normalized = normalizeMacroSplitLocks(locks);
  if (normalized.includes(field)) return true;
  return normalized.length < MAX_MACRO_SPLIT_LOCKS;
}

export function toggleMacroSplitLock(
  locks: MacroSplitField[] | undefined,
  field: MacroSplitField,
): MacroSplitField[] {
  const normalized = normalizeMacroSplitLocks(locks);
  if (normalized.includes(field)) {
    return normalized.filter((f) => f !== field);
  }
  if (normalized.length >= MAX_MACRO_SPLIT_LOCKS) return normalized;
  return [...normalized, field];
}

export function macroSplitFieldMax(
  split: MacroSplitPercent,
  field: MacroSplitField,
  locks: MacroSplitField[] | undefined,
): number {
  const normalized = normalizeMacroSplitLocks(locks);

  if (normalized.length === 2) {
    if (!normalized.includes(field)) return split[field];
    const otherLocked = normalized.find((f) => f !== field)!;
    return Math.max(0, 100 - split[otherLocked]);
  }

  if (normalized.length === 1) {
    const locked = normalized[0];
    if (field === locked) return 100;
    return Math.max(0, 100 - split[locked]);
  }

  if (field === "protein") return Math.max(0, 100 - split.carbs);
  if (field === "carbs") return Math.max(0, 100 - split.protein);
  return split.fat;
}

export function normalizeMacroSplit(
  split: MacroSplitPercent,
  locks: MacroSplitField[] | undefined = [],
): MacroSplitPercent {
  const normalizedLocks = normalizeMacroSplitLocks(locks);

  if (normalizedLocks.length === 2) {
    const [a, b] = normalizedLocks;
    const residual = MACRO_FIELDS.find((f) => f !== a && f !== b)!;
    let va = clampPct(split[a]);
    let vb = clampPct(split[b]);
    if (va + vb > 100) {
      va = Math.round((va / (va + vb)) * 100);
      vb = 100 - va;
    }
    return { [a]: va, [b]: vb, [residual]: 100 - va - vb } as MacroSplitPercent;
  }

  if (normalizedLocks.length === 1) {
    const locked = normalizedLocks[0];
    const lockedVal = clampPct(split[locked]);
    if (locked === "protein") {
      const p = lockedVal;
      const c = clampPct(Math.min(split.carbs, 100 - p));
      return { protein: p, carbs: c, fat: 100 - p - c };
    }
    if (locked === "carbs") {
      const c = lockedVal;
      const p = clampPct(Math.min(split.protein, 100 - c));
      return { protein: p, carbs: c, fat: 100 - p - c };
    }
    const f = lockedVal;
    const p = clampPct(Math.min(split.protein, 100 - f));
    return { protein: p, carbs: 100 - p - f, fat: f };
  }

  return residualFatSplit(split.protein, split.carbs);
}

/**
 * Justerer makrofordeling med valgfrie låste felt (maks 2).
 * Uten lås: protein og karb manuelt, fett = rest.
 */
export function adjustMacroSplit(
  split: MacroSplitPercent,
  field: MacroSplitField,
  nextValue: number,
  locks: MacroSplitField[] | undefined = [],
): MacroSplitPercent {
  const normalizedLocks = normalizeMacroSplitLocks(locks);
  const clamped = clampPct(nextValue);

  if (normalizedLocks.length === 0) {
    const protein = Math.round(split.protein);
    const carbs = Math.round(split.carbs);
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

  if (normalizedLocks.length === 2) {
    if (isMacroFieldDerived(field, normalizedLocks)) {
      return normalizeMacroSplit(split, normalizedLocks);
    }
    return normalizeMacroSplit({ ...split, [field]: clamped }, normalizedLocks);
  }

  const locked = normalizedLocks[0];

  if (field === locked) {
    return normalizeMacroSplit({ ...split, [field]: clamped }, normalizedLocks);
  }

  if (locked === "protein") {
    const p = clampPct(split.protein);
    if (field === "carbs") {
      const c = Math.min(clamped, 100 - p);
      return { protein: p, carbs: c, fat: 100 - p - c };
    }
    const f = Math.min(clamped, 100 - p);
    return { protein: p, carbs: 100 - p - f, fat: f };
  }

  if (locked === "carbs") {
    const c = clampPct(split.carbs);
    if (field === "protein") {
      const p = Math.min(clamped, 100 - c);
      return { protein: p, carbs: c, fat: 100 - p - c };
    }
    const f = Math.min(clamped, 100 - c);
    return { protein: 100 - c - f, carbs: c, fat: f };
  }

  const f = clampPct(split.fat);
  if (field === "protein") {
    const p = Math.min(clamped, 100 - f);
    return { protein: p, carbs: 100 - p - f, fat: f };
  }
  const c = Math.min(clamped, 100 - f);
  return { protein: 100 - c - f, carbs: c, fat: f };
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
  const locks = normalizeMacroSplitLocks(targets?.macroSplitLocked);
  const stored = targets?.macroSplitPct;
  if (stored && isValidSplit(stored)) return normalizeMacroSplit(stored, locks);
  const fromGrams = targets ? macroSplitFromTargets(targets) : null;
  if (fromGrams) return normalizeMacroSplit(fromGrams, locks);
  return { ...DEFAULT_MACRO_SPLIT };
}

function isValidSplit(split: MacroSplitPercent): boolean {
  return MACRO_FIELDS.every((field) => Number.isFinite(split[field]) && split[field] >= 0);
}

export function gramsFromKcalAndSplit(
  kcal: number,
  split: MacroSplitPercent,
  locks?: MacroSplitField[],
): Pick<MealPlanTargets, "protein" | "carbs" | "fat"> {
  const normalized = normalizeMacroSplit(split, locks);
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
  const locks = normalizeMacroSplitLocks(targets.macroSplitLocked);
  const normalized = normalizeMacroSplit(split, locks);
  const next: MealPlanTargets = { ...targets, macroSplitPct: normalized };
  if (typeof targets.kcal === "number" && targets.kcal > 0) {
    Object.assign(next, gramsFromKcalAndSplit(targets.kcal, normalized, locks));
  }
  return next;
}

export function formatMacroSplitSummary(split: MacroSplitPercent): string {
  return `P ${split.protein}% · K ${split.carbs}% · F ${split.fat}%`;
}

export function describeMacroSplitLocks(locks: MacroSplitField[] | undefined): string {
  const normalized = normalizeMacroSplitLocks(locks);
  if (normalized.length === 0) {
    return "Uten lås justeres fett automatisk. Lås opptil to makroer (f.eks. protein) for å holde prosenten fast.";
  }
  if (normalized.length === 1) {
    const label = normalized[0] === "protein" ? "Protein" : normalized[0] === "carbs" ? "Karbohydrater" : "Fett";
    return `${label} er låst — de andre makroene fyller resten til 100 %.`;
  }
  const derived = MACRO_FIELDS.find((f) => !normalized.includes(f))!;
  const derivedLabel = derived === "protein" ? "Protein" : derived === "carbs" ? "Karbohydrater" : "Fett";
  return `To makroer er låst — ${derivedLabel.toLowerCase()} beregnes som rest.`;
}
