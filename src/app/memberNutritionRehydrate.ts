import type { FoodItem, FoodNutrition } from "./foodBankTypes";
import type { MemberMealPlanState, MemberQuickFoodLogEntry } from "./memberMealPlanState";

export type NutritionLookup = Map<string, FoodNutrition>;

export function normalizeFoodLookupKey(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9æøå]+/g, "")
    .trim();
}

function nutritionSnapshotScore(nutrition: FoodNutrition): number {
  let score = 0;
  if ((nutrition.kcal ?? 0) > 0) score += 1;
  if ((nutrition.protein ?? 0) > 0) score += 1;
  if ((nutrition.carbs ?? 0) > 0) score += 1;
  if ((nutrition.fat ?? 0) > 0) score += 1;
  if ((nutrition.water ?? 0) > 0) score += 2;
  if (nutrition.micronutrients && Object.keys(nutrition.micronutrients).length > 0) score += 2;
  if (nutrition.fattyAcids && Object.keys(nutrition.fattyAcids).length > 0) score += 1;
  return score;
}

export function buildNutritionLookupByFoodName(items: FoodItem[]): NutritionLookup {
  const byName = new Map<string, FoodNutrition>();
  for (const item of items) {
    const key = normalizeFoodLookupKey(item.name);
    if (!key) continue;
    const current = byName.get(key);
    if (!current) {
      byName.set(key, item.nutritionPer100g);
      continue;
    }
    if (nutritionSnapshotScore(item.nutritionPer100g) > nutritionSnapshotScore(current)) {
      byName.set(key, item.nutritionPer100g);
    }
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
