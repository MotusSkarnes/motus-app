import { persistMemberMealPlanStateLocalAndScheduleCloud } from "./memberMealPlanStateCloud";
import type { MealPlanMeal } from "./mealPlanTypes";
import type { MemberSavedMeal } from "./memberSavedMeals";
import {
  addSavedMealToState,
  quickLogEntriesFromSavedMeal,
  removeSavedMealFromState,
} from "./memberSavedMeals";
import type { MemberMealPlanState, MemberQuickFoodLogEntry } from "./memberMealPlanState";
import {
  expandLegacyLoggedFoodIds,
  loadMemberMealPlanState,
  saveMemberMealPlanState,
  syncLoggedMealsFromFoodIds,
} from "./memberMealPlanState";

/** @deprecated Bruk MemberMealPlanState — beholdt for kompatibilitet */
export type MealPlanTrackingState = MemberMealPlanState;

export {
  toIsoDateKey,
  getWeekdayIndex,
  weekdayShortLabel,
  getTimeBasedGreeting,
  pctToward,
  mealSwapKey,
  resolveMealWithSwaps,
  setMealSwap,
  clearMealSwap,
} from "./memberMealPlanState";

export function loadMealPlanTracking(memberId: string): MemberMealPlanState {
  return loadMemberMealPlanState(memberId);
}

export function saveMealPlanTracking(memberId: string, state: MemberMealPlanState): void {
  saveMemberMealPlanState(memberId, state);
}

export function isMealLogged(state: MemberMealPlanState, dateKey: string, mealId: string): boolean {
  return (state.loggedMeals[dateKey] ?? []).includes(mealId);
}

export function isFoodLogged(state: MemberMealPlanState, dateKey: string, foodEntryId: string): boolean {
  return (state.loggedFoodIds[dateKey] ?? []).includes(foodEntryId);
}

function persistFoodLogState(
  memberId: string,
  state: MemberMealPlanState,
  dateKey: string,
  meals: MealPlanMeal[],
): MemberMealPlanState {
  const withMeals = syncLoggedMealsFromFoodIds(state, dateKey, meals);
  const nextState: MemberMealPlanState = {
    ...withMeals,
    updatedAt: new Date().toISOString(),
  };
  persistMemberMealPlanStateLocalAndScheduleCloud(memberId, nextState);
  return nextState;
}

export function isFoodSkipped(state: MemberMealPlanState, dateKey: string, foodEntryId: string): boolean {
  return (state.skippedFoodIds[dateKey] ?? []).includes(foodEntryId);
}

export function skipFoodItem(
  memberId: string,
  state: MemberMealPlanState,
  dateKey: string,
  meals: MealPlanMeal[],
  foodEntryId: string,
): MemberMealPlanState {
  const skipped = [...new Set([...(state.skippedFoodIds[dateKey] ?? []), foodEntryId])];
  const logged = (state.loggedFoodIds[dateKey] ?? []).filter((id) => id !== foodEntryId);
  const nextState: MemberMealPlanState = {
    ...state,
    skippedFoodIds: { ...state.skippedFoodIds, [dateKey]: skipped },
    loggedFoodIds: { ...state.loggedFoodIds, [dateKey]: logged },
  };
  return persistFoodLogState(memberId, nextState, dateKey, meals);
}

export function unskipFoodItem(
  memberId: string,
  state: MemberMealPlanState,
  dateKey: string,
  meals: MealPlanMeal[],
  foodEntryId: string,
): MemberMealPlanState {
  const skipped = (state.skippedFoodIds[dateKey] ?? []).filter((id) => id !== foodEntryId);
  const nextState: MemberMealPlanState = {
    ...state,
    skippedFoodIds: { ...state.skippedFoodIds, [dateKey]: skipped },
  };
  return persistFoodLogState(memberId, nextState, dateKey, meals);
}

export function addQuickFoodLog(
  memberId: string,
  state: MemberMealPlanState,
  dateKey: string,
  entry: MemberQuickFoodLogEntry,
): MemberMealPlanState {
  const logs = [entry, ...(state.quickFoodLogs[dateKey] ?? [])];
  const nextState: MemberMealPlanState = {
    ...state,
    quickFoodLogs: { ...state.quickFoodLogs, [dateKey]: logs },
    updatedAt: new Date().toISOString(),
  };
  persistMemberMealPlanStateLocalAndScheduleCloud(memberId, nextState);
  return nextState;
}

export function applySavedMealQuickLogs(
  memberId: string,
  state: MemberMealPlanState,
  dateKey: string,
  savedMeal: MemberSavedMeal,
  targetMealId: string,
): MemberMealPlanState {
  const entries = quickLogEntriesFromSavedMeal(savedMeal, targetMealId);
  const logs = [...entries, ...(state.quickFoodLogs[dateKey] ?? [])];
  const nextState: MemberMealPlanState = {
    ...state,
    quickFoodLogs: { ...state.quickFoodLogs, [dateKey]: logs },
    updatedAt: new Date().toISOString(),
  };
  persistMemberMealPlanStateLocalAndScheduleCloud(memberId, nextState);
  return nextState;
}

export function addMemberSavedMeal(
  memberId: string,
  state: MemberMealPlanState,
  meal: MemberSavedMeal,
): MemberMealPlanState {
  const nextState: MemberMealPlanState = {
    ...state,
    savedMeals: addSavedMealToState(state.savedMeals ?? [], meal),
    updatedAt: new Date().toISOString(),
  };
  persistMemberMealPlanStateLocalAndScheduleCloud(memberId, nextState);
  return nextState;
}

export function removeMemberSavedMeal(
  memberId: string,
  state: MemberMealPlanState,
  savedMealId: string,
): MemberMealPlanState {
  const nextState: MemberMealPlanState = {
    ...state,
    savedMeals: removeSavedMealFromState(state.savedMeals ?? [], savedMealId),
    updatedAt: new Date().toISOString(),
  };
  persistMemberMealPlanStateLocalAndScheduleCloud(memberId, nextState);
  return nextState;
}

export function removeQuickFoodLog(
  memberId: string,
  state: MemberMealPlanState,
  dateKey: string,
  entryId: string,
): MemberMealPlanState {
  const logs = (state.quickFoodLogs[dateKey] ?? []).filter((entry) => entry.id !== entryId);
  const nextState: MemberMealPlanState = {
    ...state,
    quickFoodLogs: { ...state.quickFoodLogs, [dateKey]: logs },
    updatedAt: new Date().toISOString(),
  };
  persistMemberMealPlanStateLocalAndScheduleCloud(memberId, nextState);
  return nextState;
}

export function toggleFoodLogged(
  memberId: string,
  state: MemberMealPlanState,
  dateKey: string,
  meals: MealPlanMeal[],
  foodEntryId: string,
): MemberMealPlanState {
  const current = [...(state.loggedFoodIds[dateKey] ?? [])];
  const idx = current.indexOf(foodEntryId);
  if (idx >= 0) current.splice(idx, 1);
  else current.push(foodEntryId);
  const nextState: MemberMealPlanState = {
    ...state,
    loggedFoodIds: { ...state.loggedFoodIds, [dateKey]: current },
  };
  return persistFoodLogState(memberId, nextState, dateKey, meals);
}

export function removeFoodLogged(
  memberId: string,
  state: MemberMealPlanState,
  dateKey: string,
  meals: MealPlanMeal[],
  foodEntryId: string,
): MemberMealPlanState {
  const current = (state.loggedFoodIds[dateKey] ?? []).filter((id) => id !== foodEntryId);
  const nextState: MemberMealPlanState = {
    ...state,
    loggedFoodIds: { ...state.loggedFoodIds, [dateKey]: current },
  };
  return persistFoodLogState(memberId, nextState, dateKey, meals);
}

export function toggleMealLogged(
  memberId: string,
  state: MemberMealPlanState,
  dateKey: string,
  mealId: string,
  meal: MealPlanMeal | undefined,
  dayMeals: MealPlanMeal[],
): MemberMealPlanState {
  const mealIds = state.loggedMeals[dateKey] ?? [];
  const foodIds = [...(state.loggedFoodIds[dateKey] ?? [])];
  const skipped = new Set(state.skippedFoodIds[dateKey] ?? []);
  const mealFoodIds = meal?.items.filter((item) => !skipped.has(item.id)).map((item) => item.id) ?? [];
  const isLogged = mealIds.includes(mealId);

  let nextFood = foodIds;
  if (isLogged) {
    if (mealFoodIds.length > 0) {
      const remove = new Set(mealFoodIds);
      nextFood = foodIds.filter((id) => !remove.has(id));
    }
  } else if (mealFoodIds.length > 0) {
    nextFood = [...new Set([...foodIds, ...mealFoodIds])];
  }

  const nextState: MemberMealPlanState = syncLoggedMealsFromFoodIds(
    {
      ...state,
      loggedFoodIds: { ...state.loggedFoodIds, [dateKey]: nextFood },
    },
    dateKey,
    dayMeals,
  );

  const mergedState: MemberMealPlanState = {
    ...nextState,
    updatedAt: new Date().toISOString(),
  };
  persistMemberMealPlanStateLocalAndScheduleCloud(memberId, mergedState);
  return mergedState;
}

export function prepareMealPlanTracking(
  state: MemberMealPlanState,
  dateKey: string,
  meals: MealPlanMeal[],
): MemberMealPlanState {
  return expandLegacyLoggedFoodIds(state, dateKey, meals);
}

export function setWaterLiters(
  memberId: string,
  state: MemberMealPlanState,
  dateKey: string,
  liters: number,
): MemberMealPlanState {
  const nextState: MemberMealPlanState = {
    ...state,
    waterLiters: { ...state.waterLiters, [dateKey]: Math.max(0, liters) },
    updatedAt: new Date().toISOString(),
  };
  persistMemberMealPlanStateLocalAndScheduleCloud(memberId, nextState);
  return nextState;
}

export function setRecipePortionMultiplier(
  memberId: string,
  state: MemberMealPlanState,
  entryId: string,
  multiplier: number,
): MemberMealPlanState {
  const safe = Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1;
  const nextState: MemberMealPlanState = {
    ...state,
    recipePortions: { ...state.recipePortions, [entryId]: safe },
    updatedAt: new Date().toISOString(),
  };
  persistMemberMealPlanStateLocalAndScheduleCloud(memberId, nextState);
  return nextState;
}

export function toggleShoppingChecked(
  memberId: string,
  state: MemberMealPlanState,
  itemKey: string,
): MemberMealPlanState {
  const set = new Set(state.checkedShopping);
  if (set.has(itemKey)) set.delete(itemKey);
  else set.add(itemKey);
  const nextState: MemberMealPlanState = {
    ...state,
    checkedShopping: [...set],
    updatedAt: new Date().toISOString(),
  };
  persistMemberMealPlanStateLocalAndScheduleCloud(memberId, nextState);
  return nextState;
}

export function computeNutritionStreak(
  loggedMeals: Record<string, string[]>,
  loggedFoodIds: Record<string, string[]> = {},
): number {
  const today = new Date();
  let streak = 0;
  for (let offset = 0; offset < 365; offset += 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - offset);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const key = `${y}-${m}-${day}`;
    const hasFood = (loggedFoodIds[key] ?? []).length > 0;
    const hasMeals = (loggedMeals[key] ?? []).length > 0;
    if (hasFood || hasMeals) {
      streak += 1;
    } else if (offset > 0) {
      break;
    }
  }
  return streak;
}
