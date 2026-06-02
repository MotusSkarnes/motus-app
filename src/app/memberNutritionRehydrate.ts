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

function foodNameTokens(name: string): string[] {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .split(/[^a-z0-9æøå]+/)
    .filter((token) => token.length >= 2);
}

function foodNameKeysMatch(logName: string, itemName: string): boolean {
  const logKey = normalizeFoodLookupKey(logName);
  const itemKey = normalizeFoodLookupKey(itemName);
  if (!logKey || !itemKey) return false;
  if (logKey === itemKey) return true;
  if (logKey.startsWith(itemKey) || itemKey.startsWith(logKey)) return true;
  if (logKey.length >= 4 && itemKey.includes(logKey)) return true;
  if (itemKey.length >= 4 && logKey.includes(itemKey)) return true;

  const logTokens = foodNameTokens(logName);
  const itemTokens = foodNameTokens(itemName);
  if (!logTokens.length || !itemTokens.length) return false;
  const itemTokenSet = new Set(itemTokens);
  const logTokenSet = new Set(logTokens);
  if (logTokens.every((token) => itemTokenSet.has(token))) return true;
  if (itemTokens.every((token) => logTokenSet.has(token))) return true;
  if (logTokens[0] === itemTokens[0] && logTokens[0]!.length >= 3) {
    const shared = logTokens.filter((token) => itemTokenSet.has(token)).length;
    const minLen = Math.min(logTokens.length, itemTokens.length);
    if (shared >= minLen - 1 || shared >= 2) return true;
  }
  return false;
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

/** Løser næring fra matvarebank med fuzzy navnematch (f.eks. logg «Olden uten kullsyre»). */
export function resolveNutritionFromFoodItems(
  foodName: string,
  stored: MemberQuickFoodLogEntry["nutritionPer100g"],
  items: FoodItem[],
): MemberQuickFoodLogEntry["nutritionPer100g"] {
  if (!items.length) return stored;
  if (!normalizeFoodLookupKey(foodName)) return stored;

  let best: FoodNutrition | null = null;
  let bestScore = nutritionSnapshotScore(stored);
  for (const item of items) {
    if (!foodNameKeysMatch(foodName, item.name)) continue;
    const score = nutritionSnapshotScore(item.nutritionPer100g);
    if (score > bestScore) {
      bestScore = score;
      best = item.nutritionPer100g;
    }
  }
  if (!best) return stored;
  return cloneNutritionSnapshot(best);
}

export function rehydrateMemberMealPlanState(
  state: MemberMealPlanState,
  foodItems: FoodItem[],
): { next: MemberMealPlanState; updates: number } {
  let updates = 0;
  const quickFoodLogs = Object.fromEntries(
    Object.entries(state.quickFoodLogs).map(([dateKey, logs]) => [
      dateKey,
      logs.map((entry) => {
        const latest = resolveNutritionFromFoodItems(entry.name, entry.nutritionPer100g, foodItems);
        if (nutritionSnapshotsEqual(entry.nutritionPer100g, latest)) return entry;
        updates += 1;
        return { ...entry, nutritionPer100g: latest };
      }),
    ]),
  );
  const savedMeals = (state.savedMeals ?? []).map((meal) => ({
    ...meal,
    items: meal.items.map((item) => {
      const latest = resolveNutritionFromFoodItems(item.name, item.nutritionPer100g, foodItems);
      if (nutritionSnapshotsEqual(item.nutritionPer100g, latest)) return item;
      updates += 1;
      return { ...item, nutritionPer100g: latest };
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
