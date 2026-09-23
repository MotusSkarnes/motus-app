import { mealSwapKey, resolveMealWithSwaps, type MemberMealPlanState } from "./memberMealPlanState";
import type { MealPlan, MealPlanMeal } from "./mealPlanTypes";

export type TrainerCompletedMealRow = {
  mealId: string;
  mealName: string;
  displayTitle: string;
  changed: boolean;
  changeLabels: string[];
};

function mealTitle(meal: MealPlanMeal): string {
  return meal.items[0]?.foodName?.trim() || meal.name.trim() || "Måltid";
}

export function completedMealRowsForTrainer(
  plan: MealPlan | null | undefined,
  state: MemberMealPlanState,
  dateKey: string,
): TrainerCompletedMealRow[] {
  if (!plan) return [];
  const completedIds = new Set(state.loggedMeals[dateKey] ?? []);
  if (!completedIds.size) return [];

  const skippedIds = new Set(state.skippedFoodIds[dateKey] ?? []);
  const quickLogs = state.quickFoodLogs[dateKey] ?? [];
  const rows: TrainerCompletedMealRow[] = [];

  for (const day of plan.days) {
    for (const plannedMeal of day.meals) {
      if (!completedIds.has(plannedMeal.id)) continue;
      const effectiveMeal = resolveMealWithSwaps(plan, plannedMeal, dateKey, state.mealSwaps);
      const swapped = Boolean(state.mealSwaps[mealSwapKey(dateKey, plannedMeal.id)]);
      const removedCount = effectiveMeal.items.filter((item) => skippedIds.has(item.id)).length;
      const addedCount = quickLogs.filter((entry) => entry.mealId === plannedMeal.id).length;
      const changeLabels: string[] = [];
      if (swapped) changeLabels.push("Byttet måltid");
      if (removedCount > 0) changeLabels.push(`${removedCount} ${removedCount === 1 ? "planvare fjernet" : "planvarer fjernet"}`);
      if (addedCount > 0) changeLabels.push(`${addedCount} ${addedCount === 1 ? "egen matvare lagt til" : "egne matvarer lagt til"}`);
      rows.push({
        mealId: plannedMeal.id,
        mealName: plannedMeal.name.trim() || "Måltid",
        displayTitle: mealTitle(effectiveMeal),
        changed: changeLabels.length > 0,
        changeLabels,
      });
    }
  }

  return rows;
}

export function mealPlanActivityDateKeys(state: MemberMealPlanState): string[] {
  const keys = new Set<string>([
    ...Object.keys(state.loggedMeals),
    ...Object.keys(state.loggedFoodIds),
    ...Object.keys(state.quickFoodLogs),
    ...Object.keys(state.skippedFoodIds),
  ]);
  for (const key of Object.keys(state.mealSwaps)) {
    const dateKey = key.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) keys.add(dateKey);
  }
  return [...keys];
}
