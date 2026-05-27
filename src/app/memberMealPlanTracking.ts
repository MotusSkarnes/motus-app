export type MealPlanTrackingState = {
  /** dateKey (YYYY-MM-DD) → meal ids logged that day */
  loggedMeals: Record<string, string[]>;
  /** dateKey → liters consumed */
  waterLiters: Record<string, number>;
  /** shopping item keys checked off */
  checkedShopping: string[];
};

const STORAGE_PREFIX = "motus.member.mealPlanTracking.v1";

function storageKey(memberId: string): string {
  return `${STORAGE_PREFIX}:${memberId.trim()}`;
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

export function loadMealPlanTracking(memberId: string): MealPlanTrackingState {
  if (!memberId.trim() || typeof window === "undefined") {
    return { loggedMeals: {}, waterLiters: {}, checkedShopping: [] };
  }
  try {
    const raw = window.localStorage.getItem(storageKey(memberId));
    if (!raw) return { loggedMeals: {}, waterLiters: {}, checkedShopping: [] };
    const parsed = JSON.parse(raw) as Partial<MealPlanTrackingState>;
    return {
      loggedMeals: parsed.loggedMeals && typeof parsed.loggedMeals === "object" ? parsed.loggedMeals : {},
      waterLiters: parsed.waterLiters && typeof parsed.waterLiters === "object" ? parsed.waterLiters : {},
      checkedShopping: Array.isArray(parsed.checkedShopping) ? parsed.checkedShopping : [],
    };
  } catch {
    return { loggedMeals: {}, waterLiters: {}, checkedShopping: [] };
  }
}

export function saveMealPlanTracking(memberId: string, state: MealPlanTrackingState): void {
  if (!memberId.trim() || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(memberId), JSON.stringify(state));
  } catch {
    /* ignore quota errors */
  }
}

export function isMealLogged(state: MealPlanTrackingState, dateKey: string, mealId: string): boolean {
  return (state.loggedMeals[dateKey] ?? []).includes(mealId);
}

export function toggleMealLogged(
  memberId: string,
  state: MealPlanTrackingState,
  dateKey: string,
  mealId: string,
): MealPlanTrackingState {
  const current = state.loggedMeals[dateKey] ?? [];
  const next = current.includes(mealId) ? current.filter((id) => id !== mealId) : [...current, mealId];
  const loggedMeals = { ...state.loggedMeals, [dateKey]: next };
  const nextState = { ...state, loggedMeals };
  saveMealPlanTracking(memberId, nextState);
  return nextState;
}

export function setWaterLiters(
  memberId: string,
  state: MealPlanTrackingState,
  dateKey: string,
  liters: number,
): MealPlanTrackingState {
  const nextState = { ...state, waterLiters: { ...state.waterLiters, [dateKey]: Math.max(0, liters) } };
  saveMealPlanTracking(memberId, nextState);
  return nextState;
}

export function toggleShoppingChecked(
  memberId: string,
  state: MealPlanTrackingState,
  itemKey: string,
): MealPlanTrackingState {
  const set = new Set(state.checkedShopping);
  if (set.has(itemKey)) set.delete(itemKey);
  else set.add(itemKey);
  const nextState = { ...state, checkedShopping: [...set] };
  saveMealPlanTracking(memberId, nextState);
  return nextState;
}

export function computeNutritionStreak(loggedMeals: Record<string, string[]>): number {
  const today = new Date();
  let streak = 0;
  for (let offset = 0; offset < 365; offset += 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - offset);
    const key = toIsoDateKey(d);
    const logged = loggedMeals[key] ?? [];
    if (logged.length > 0) {
      streak += 1;
    } else if (offset > 0) {
      break;
    }
  }
  return streak;
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
