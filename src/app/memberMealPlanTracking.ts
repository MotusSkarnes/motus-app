import { persistMemberMealPlanStateLocalAndScheduleCloud } from "./memberMealPlanStateCloud";
import type { MemberMealPlanState } from "./memberMealPlanState";
import { loadMemberMealPlanState, saveMemberMealPlanState } from "./memberMealPlanState";

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

export function toggleMealLogged(
  memberId: string,
  state: MemberMealPlanState,
  dateKey: string,
  mealId: string,
): MemberMealPlanState {
  const current = state.loggedMeals[dateKey] ?? [];
  const next = current.includes(mealId) ? current.filter((id) => id !== mealId) : [...current, mealId];
  const nextState: MemberMealPlanState = {
    ...state,
    loggedMeals: { ...state.loggedMeals, [dateKey]: next },
    updatedAt: new Date().toISOString(),
  };
  persistMemberMealPlanStateLocalAndScheduleCloud(memberId, nextState);
  return nextState;
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

export function computeNutritionStreak(loggedMeals: Record<string, string[]>): number {
  const today = new Date();
  let streak = 0;
  for (let offset = 0; offset < 365; offset += 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - offset);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const key = `${y}-${m}-${day}`;
    const logged = loggedMeals[key] ?? [];
    if (logged.length > 0) {
      streak += 1;
    } else if (offset > 0) {
      break;
    }
  }
  return streak;
}
