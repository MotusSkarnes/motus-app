import { buildBodyMetricsTimeline } from "./memberBodyMetrics";
import { parsePersonalGoalsJson, patchPersonalGoalsJson } from "./memberProfilePayload";
import {
  mealPlanTargetsHaveValues,
  parseMealPlanTargets,
  proteinGramsFromPerKg,
} from "./mealPlanTargetBalance";
import type { MealPlanTargets } from "./mealPlanTypes";

export function parseMemberWeightKg(weight: string | undefined): number | null {
  const raw = String(weight ?? "")
    .trim()
    .replace(",", ".")
    .replace(/[^\d.]/g, "");
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 20 || n > 400) return null;
  return Math.round(n * 10) / 10;
}

export type MemberWeightSource = "metrics" | "profile";

export type ResolvedMemberWeight = {
  kg: number;
  source: MemberWeightSource;
};

export function resolveMemberBodyWeight(
  profileWeight?: string,
  personalGoals?: string,
): ResolvedMemberWeight | null {
  const timeline = buildBodyMetricsTimeline(personalGoals);
  const latest = timeline.weightSeries[timeline.weightSeries.length - 1]?.value;
  if (typeof latest === "number" && latest >= 20 && latest <= 400) {
    return { kg: latest, source: "metrics" };
  }
  const fromProfile = parseMemberWeightKg(profileWeight);
  if (fromProfile == null) return null;
  return { kg: fromProfile, source: "profile" };
}

export function readNutritionTargetsFromPersonalGoals(
  personalGoals: string | undefined,
): MealPlanTargets | undefined {
  const payload = parsePersonalGoalsJson(personalGoals);
  if (!payload) return undefined;
  return parseMealPlanTargets(payload.nutritionTargets);
}

function serializeNutritionTargets(targets: MealPlanTargets): Record<string, unknown> {
  const row: Record<string, unknown> = {
    updatedAt: typeof targets.updatedAt === "number" && targets.updatedAt > 0 ? targets.updatedAt : Date.now(),
  };
  if (typeof targets.kcal === "number" && Number.isFinite(targets.kcal)) row.kcal = targets.kcal;
  if (typeof targets.protein === "number" && Number.isFinite(targets.protein)) row.protein = targets.protein;
  if (typeof targets.carbs === "number" && Number.isFinite(targets.carbs)) row.carbs = targets.carbs;
  if (typeof targets.fat === "number" && Number.isFinite(targets.fat)) row.fat = targets.fat;
  if (typeof targets.proteinPerKg === "number" && Number.isFinite(targets.proteinPerKg) && targets.proteinPerKg > 0) {
    row.proteinPerKg = targets.proteinPerKg;
  }
  if (targets.kcalLocked === true) row.kcalLocked = true;
  if (targets.macroSplitPct) row.macroSplitPct = targets.macroSplitPct;
  if (targets.macroSplitLocked?.length) row.macroSplitLocked = targets.macroSplitLocked;
  return row;
}

export function patchNutritionTargetsInPersonalGoals(
  existingPersonalGoals: string | undefined,
  targets: MealPlanTargets | undefined,
): string {
  if (!mealPlanTargetsHaveValues(targets)) {
    return patchPersonalGoalsJson(existingPersonalGoals, { nutritionTargets: undefined });
  }
  return patchPersonalGoalsJson(existingPersonalGoals, {
    nutritionTargets: serializeNutritionTargets(targets),
  });
}

export function stampNutritionTargets(targets: MealPlanTargets | undefined): MealPlanTargets | undefined {
  if (!mealPlanTargetsHaveValues(targets)) return undefined;
  return { ...targets, updatedAt: Date.now() };
}

export function resolveDailyNutritionTargets(
  personalGoals: string | undefined,
  planTargets?: MealPlanTargets | null,
): MealPlanTargets | undefined {
  const fromProfile = readNutritionTargetsFromPersonalGoals(personalGoals);
  const profileHas = mealPlanTargetsHaveValues(fromProfile);
  const planHas = mealPlanTargetsHaveValues(planTargets);
  if (profileHas && planHas) {
    const profileAt = fromProfile?.updatedAt ?? 0;
    const planAt = planTargets?.updatedAt ?? 0;
    return planAt > profileAt ? planTargets! : fromProfile!;
  }
  if (profileHas) return fromProfile;
  if (planHas) return planTargets ?? undefined;
  return undefined;
}

/** Oppdater proteingram når vekt og g/kg er kjent. */
export function syncProteinGramsFromPerKg(
  targets: MealPlanTargets | undefined,
  bodyWeightKg: number | null,
): MealPlanTargets | undefined {
  if (!targets) return targets;
  if (!(bodyWeightKg && bodyWeightKg > 0)) return targets;
  if (typeof targets.proteinPerKg !== "number" || !(targets.proteinPerKg > 0)) return targets;
  const protein = proteinGramsFromPerKg(targets.proteinPerKg, bodyWeightKg);
  if (targets.protein === protein) return targets;
  return { ...targets, protein };
}
