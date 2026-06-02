import type { FoodItem, FoodNutrition } from "./foodBankTypes";
import {
  EMPTY_MEMBER_MEAL_PLAN_STATE,
  stateUpdatedAtMs,
  type MemberMealPlanState,
  type MemberQuickFoodLogEntry,
} from "./memberMealPlanState";
import { mergeMemberSavedMeals } from "./memberSavedMeals";

export type NutritionLookup = Map<string, FoodNutrition>;

export function normalizeFoodLookupKey(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9æøå]+/g, "")
    .trim();
}

export function buildNutritionLookupByFoodName(items: FoodItem[]): NutritionLookup {
  const byName = new Map<string, FoodNutrition>();
  for (const item of items) {
    const key = normalizeFoodLookupKey(item.name);
    if (!key || byName.has(key)) continue;
    byName.set(key, item.nutritionPer100g);
  }
  return byName;
}

export function cloneNutritionSnapshot(nutrition: FoodNutrition): FoodNutrition {
  return {
    ...nutrition,
    fattyAcids: nutrition.fattyAcids ? { ...nutrition.fattyAcids } : undefined,
    micronutrients: { ...(nutrition.micronutrients ?? {}) },
  };
}

export function nutritionSnapshotsEqual(left: FoodNutrition, right: FoodNutrition): boolean {
  if (Object.is(left, right)) return true;
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]) as Set<keyof FoodNutrition>;
  for (const key of keys) {
    const leftValue = left[key];
    const rightValue = right[key];
    if (
      leftValue !== null &&
      rightValue !== null &&
      typeof leftValue === "object" &&
      typeof rightValue === "object" &&
      !Array.isArray(leftValue) &&
      !Array.isArray(rightValue)
    ) {
      if (!nutritionSnapshotsEqual(leftValue as FoodNutrition, rightValue as FoodNutrition)) return false;
      continue;
    }
    if (!Object.is(leftValue, rightValue)) return false;
  }
  return true;
}

export function resolveNutritionFromLookup(
  foodName: string,
  stored: MemberQuickFoodLogEntry["nutritionPer100g"],
  lookup: NutritionLookup,
): MemberQuickFoodLogEntry["nutritionPer100g"] {
  const latest = lookup.get(normalizeFoodLookupKey(foodName));
  if (!latest) return stored;
  return cloneNutritionSnapshot(latest);
}

function mergeStringArrayRecords(
  left: Record<string, string[]>,
  right: Record<string, string[]>,
): Record<string, string[]> {
  const merged: Record<string, string[]> = { ...left };
  for (const [key, values] of Object.entries(right)) {
    merged[key] = [...new Set([...(merged[key] ?? []), ...values.map(String).filter(Boolean)])];
  }
  return merged;
}

function mergeQuickFoodLogRecords(
  left: Record<string, MemberQuickFoodLogEntry[]>,
  right: Record<string, MemberQuickFoodLogEntry[]>,
): Record<string, MemberQuickFoodLogEntry[]> {
  const merged: Record<string, MemberQuickFoodLogEntry[]> = { ...left };
  for (const [dateKey, entries] of Object.entries(right)) {
    const byId = new Map<string, MemberQuickFoodLogEntry>();
    for (const entry of merged[dateKey] ?? []) byId.set(entry.id, entry);
    for (const entry of entries) byId.set(entry.id, entry);
    merged[dateKey] = [...byId.values()].sort((a, b) => Date.parse(a.loggedAt) - Date.parse(b.loggedAt));
  }
  return merged;
}

export function mergeMemberMealPlanStatesForNutritionRehydrate(
  states: MemberMealPlanState[],
): MemberMealPlanState | null {
  if (!states.length) return null;
  const ordered = states
    .map((state, index) => ({ state, index, updatedAtMs: stateUpdatedAtMs(state) }))
    .sort((a, b) => a.updatedAtMs - b.updatedAtMs || a.index - b.index);
  let newestUpdatedAt: string | undefined;
  let newestUpdatedAtMs = 0;
  let merged: MemberMealPlanState = { ...EMPTY_MEMBER_MEAL_PLAN_STATE, savedMeals: [] };

  for (const { state, updatedAtMs } of ordered) {
    if (updatedAtMs >= newestUpdatedAtMs) {
      newestUpdatedAt = state.updatedAt;
      newestUpdatedAtMs = updatedAtMs;
    }
    merged = {
      loggedMeals: mergeStringArrayRecords(merged.loggedMeals, state.loggedMeals),
      loggedFoodIds: mergeStringArrayRecords(merged.loggedFoodIds, state.loggedFoodIds),
      waterLiters: { ...merged.waterLiters, ...state.waterLiters },
      checkedShopping: [...new Set([...merged.checkedShopping, ...state.checkedShopping])],
      recipePortions: { ...merged.recipePortions, ...state.recipePortions },
      mealSwaps: { ...merged.mealSwaps, ...state.mealSwaps },
      quickFoodLogs: mergeQuickFoodLogRecords(merged.quickFoodLogs, state.quickFoodLogs),
      skippedFoodIds: mergeStringArrayRecords(merged.skippedFoodIds, state.skippedFoodIds),
      savedMeals: mergeMemberSavedMeals(merged.savedMeals, state.savedMeals ?? []),
      updatedAt: newestUpdatedAt,
    };
  }

  return merged;
}

export function rehydrateMemberMealPlanState(
  state: MemberMealPlanState,
  lookup: NutritionLookup,
): { next: MemberMealPlanState; updates: number } {
  let updates = 0;
  const quickFoodLogs = Object.fromEntries(
    Object.entries(state.quickFoodLogs).map(([dateKey, logs]) => [
      dateKey,
      logs.map((entry) => {
        const latest = lookup.get(normalizeFoodLookupKey(entry.name));
        if (!latest) return entry;
        if (nutritionSnapshotsEqual(entry.nutritionPer100g, latest)) return entry;
        updates += 1;
        return { ...entry, nutritionPer100g: cloneNutritionSnapshot(latest) };
      }),
    ]),
  );
  const savedMeals = (state.savedMeals ?? []).map((meal) => ({
    ...meal,
    items: meal.items.map((item) => {
      const latest = lookup.get(normalizeFoodLookupKey(item.name));
      if (!latest) return item;
      if (nutritionSnapshotsEqual(item.nutritionPer100g, latest)) return item;
      updates += 1;
      return { ...item, nutritionPer100g: cloneNutritionSnapshot(latest) };
    }),
  }));
  return {
    next: {
      ...state,
      quickFoodLogs,
      savedMeals,
      updatedAt: updates > 0 ? new Date().toISOString() : state.updatedAt,
    },
    updates,
  };
}
