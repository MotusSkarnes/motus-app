import { canonicalMemberMealSlotId } from "./memberMealSlots";
import { getWeekdayIndex, resolveMealWithSwaps, type MemberMealPlanState, type MemberQuickFoodLogEntry } from "./memberMealPlanState";
import type { MealPlan } from "./mealPlanTypes";

function dateFromKey(dateKey: string): Date | null {
  const match = dateKey.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Planvarer som kunden faktisk har huket av, representert på samme form som frie matlogger. */
export function completedPlanFoodLogsForDate(
  plan: MealPlan | null | undefined,
  state: MemberMealPlanState,
  dateKey: string,
): MemberQuickFoodLogEntry[] {
  if (!plan?.days.length) return [];
  const date = dateFromKey(dateKey);
  if (!date) return [];
  const day = plan.days[getWeekdayIndex(date)];
  if (!day) return [];

  const loggedMeals = new Set(state.loggedMeals[dateKey] ?? []);
  const loggedFoodIds = new Set(state.loggedFoodIds[dateKey] ?? []);
  const skippedFoodIds = new Set(state.skippedFoodIds[dateKey] ?? []);
  const rows: MemberQuickFoodLogEntry[] = [];

  for (const plannedMeal of day.meals) {
    const meal = resolveMealWithSwaps(plan, plannedMeal, dateKey, state.mealSwaps);
    const wholeMealLogged = loggedMeals.has(plannedMeal.id);
    for (const item of meal.items) {
      if (skippedFoodIds.has(item.id)) continue;
      if (!wholeMealLogged && !loggedFoodIds.has(item.id)) continue;
      rows.push({
        id: `plan:${dateKey}:${plannedMeal.id}:${item.id}`,
        name: item.foodName,
        grams: item.grams,
        source: "food",
        loggedAt: `${dateKey}T12:00:00.000Z`,
        foodId: item.foodId,
        mealId: canonicalMemberMealSlotId(plannedMeal.id, plannedMeal.name),
        nutritionPer100g: item.nutritionPer100g,
      });
    }
  }
  return rows;
}

export function trainerFoodLogsForDate(
  plan: MealPlan | null | undefined,
  state: MemberMealPlanState,
  dateKey: string,
): MemberQuickFoodLogEntry[] {
  return [...completedPlanFoodLogsForDate(plan, state, dateKey), ...(state.quickFoodLogs[dateKey] ?? [])];
}
