import type { MealPlan, MealPlanMeal } from "./mealPlanTypes";

export type MealSwapRef = {
  sourceDayId: string;
  sourceMealId: string;
};

export type MemberMealPlanState = {
  loggedMeals: Record<string, string[]>;
  waterLiters: Record<string, number>;
  checkedShopping: string[];
  /** `${dateKey}:${targetMealId}` → kilde-måltid fra planen */
  mealSwaps: Record<string, MealSwapRef>;
  updatedAt?: string;
};

export const EMPTY_MEMBER_MEAL_PLAN_STATE: MemberMealPlanState = {
  loggedMeals: {},
  waterLiters: {},
  checkedShopping: [],
  mealSwaps: {},
};

export const MEAL_PLAN_STATE_CHANGED_EVENT = "motus-meal-plan-state-changed";

const STORAGE_PREFIX = "motus.member.mealPlanState.v1";

function storageKey(memberId: string): string {
  return `${STORAGE_PREFIX}:${memberId.trim()}`;
}

export function mealSwapKey(dateKey: string, targetMealId: string): string {
  return `${dateKey}:${targetMealId}`;
}

export function parseMemberMealPlanState(value: unknown): MemberMealPlanState {
  if (!value || typeof value !== "object") return { ...EMPTY_MEMBER_MEAL_PLAN_STATE };
  const row = value as Record<string, unknown>;
  const mealSwapsRaw = row.mealSwaps ?? row.meal_swaps;
  const mealSwaps: Record<string, MealSwapRef> = {};
  if (mealSwapsRaw && typeof mealSwapsRaw === "object") {
    for (const [key, swap] of Object.entries(mealSwapsRaw as Record<string, unknown>)) {
      if (!swap || typeof swap !== "object") continue;
      const s = swap as Record<string, unknown>;
      const sourceDayId = String(s.sourceDayId ?? s.source_day_id ?? "").trim();
      const sourceMealId = String(s.sourceMealId ?? s.source_meal_id ?? "").trim();
      if (sourceDayId && sourceMealId) {
        mealSwaps[key] = { sourceDayId, sourceMealId };
      }
    }
  }
  return {
    loggedMeals:
      row.loggedMeals && typeof row.loggedMeals === "object"
        ? (row.loggedMeals as Record<string, string[]>)
        : row.logged_meals && typeof row.logged_meals === "object"
          ? (row.logged_meals as Record<string, string[]>)
          : {},
    waterLiters:
      row.waterLiters && typeof row.waterLiters === "object"
        ? (row.waterLiters as Record<string, number>)
        : row.water_liters && typeof row.water_liters === "object"
          ? (row.water_liters as Record<string, number>)
          : {},
    checkedShopping: Array.isArray(row.checkedShopping)
      ? row.checkedShopping.map(String)
      : Array.isArray(row.checked_shopping)
        ? row.checked_shopping.map(String)
        : [],
    mealSwaps,
    updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : typeof row.updated_at === "string" ? row.updated_at : undefined,
  };
}

export function loadMemberMealPlanState(memberId: string): MemberMealPlanState {
  if (!memberId.trim() || typeof window === "undefined") {
    return { ...EMPTY_MEMBER_MEAL_PLAN_STATE };
  }
  try {
    const raw = window.localStorage.getItem(storageKey(memberId));
    if (!raw) return { ...EMPTY_MEMBER_MEAL_PLAN_STATE };
    return parseMemberMealPlanState(JSON.parse(raw));
  } catch {
    return { ...EMPTY_MEMBER_MEAL_PLAN_STATE };
  }
}

export function saveMemberMealPlanState(memberId: string, state: MemberMealPlanState, options?: { notify?: boolean }): void {
  if (!memberId.trim() || typeof window === "undefined") return;
  const next: MemberMealPlanState = {
    ...state,
    updatedAt: state.updatedAt ?? new Date().toISOString(),
  };
  try {
    window.localStorage.setItem(storageKey(memberId), JSON.stringify(next));
    if (options?.notify !== false) {
      window.dispatchEvent(new CustomEvent(MEAL_PLAN_STATE_CHANGED_EVENT));
    }
  } catch {
    /* ignore */
  }
}

export function resolveMealWithSwaps(
  plan: MealPlan,
  meal: MealPlanMeal,
  dateKey: string,
  mealSwaps: Record<string, MealSwapRef>,
): MealPlanMeal {
  const swap = mealSwaps[mealSwapKey(dateKey, meal.id)];
  if (!swap) return meal;
  const sourceDay = plan.days.find((day) => day.id === swap.sourceDayId);
  const sourceMeal = sourceDay?.meals.find((row) => row.id === swap.sourceMealId);
  if (!sourceMeal?.items.length) return meal;
  return {
    ...meal,
    items: sourceMeal.items.map((item) => ({ ...item })),
  };
}

export function setMealSwap(
  state: MemberMealPlanState,
  dateKey: string,
  targetMealId: string,
  sourceDayId: string,
  sourceMealId: string,
): MemberMealPlanState {
  return {
    ...state,
    mealSwaps: {
      ...state.mealSwaps,
      [mealSwapKey(dateKey, targetMealId)]: { sourceDayId, sourceMealId },
    },
    updatedAt: new Date().toISOString(),
  };
}

export function clearMealSwap(state: MemberMealPlanState, dateKey: string, targetMealId: string): MemberMealPlanState {
  const key = mealSwapKey(dateKey, targetMealId);
  if (!state.mealSwaps[key]) return state;
  const mealSwaps = { ...state.mealSwaps };
  delete mealSwaps[key];
  return { ...state, mealSwaps, updatedAt: new Date().toISOString() };
}

export function stateUpdatedAtMs(state: MemberMealPlanState | null | undefined): number {
  const raw = state?.updatedAt?.trim();
  if (!raw) return 0;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? ms : 0;
}

export function toIsoDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** 0 = Monday … 6 = Sunday (matches createDefaultMealPlanDays order). */
export function getWeekdayIndex(date = new Date()): number {
  return (date.getDay() + 6) % 7;
}

const WEEKDAY_SHORT = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"];

export function weekdayShortLabel(index: number): string {
  return WEEKDAY_SHORT[Math.max(0, Math.min(6, index))] ?? "?";
}

export function getTimeBasedGreeting(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 10) return "God morgen";
  if (hour < 17) return "God dag";
  return "God kveld";
}

export function pctToward(current: number, target: number): number {
  if (!target || target <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((current / target) * 100)));
}

export function mergeMemberMealPlanStates(local: MemberMealPlanState, remote: MemberMealPlanState): MemberMealPlanState {
  const localMs = stateUpdatedAtMs(local);
  const remoteMs = stateUpdatedAtMs(remote);
  if (remoteMs > localMs) return remote;
  if (localMs > remoteMs) return local;
  return {
    loggedMeals: { ...remote.loggedMeals, ...local.loggedMeals },
    waterLiters: { ...remote.waterLiters, ...local.waterLiters },
    checkedShopping: [...new Set([...remote.checkedShopping, ...local.checkedShopping])],
    mealSwaps: { ...remote.mealSwaps, ...local.mealSwaps },
    updatedAt: new Date(Math.max(localMs, remoteMs, Date.now())).toISOString(),
  };
}
