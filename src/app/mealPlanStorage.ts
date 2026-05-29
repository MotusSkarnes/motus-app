import { createDefaultMealPlan } from "./mealPlanDefaults";
import type { MealPlan } from "./mealPlanTypes";

export const MEAL_PLANS_STORAGE_KEY = "motus_meal_plans_v1";
export const MEAL_PLAN_HISTORY_STORAGE_KEY = "motus_meal_plan_history_v1";
export const MEAL_PLAN_CHANGED_EVENT = "motus-meal-plan-changed";
const MAX_HISTORY_PER_MEMBER = 20;

export type MealPlanHistoryEntry = {
  id: string;
  savedAt: string;
  plan: MealPlan;
};

export function readAllMealPlans(): Record<string, MealPlan> {
  return readPlans();
}

function readPlans(): Record<string, MealPlan> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(MEAL_PLANS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, MealPlan>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writePlans(plans: Record<string, MealPlan>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MEAL_PLANS_STORAGE_KEY, JSON.stringify(plans));
  } catch (error) {
    console.warn("meal plan localStorage write failed:", error);
  }
}

function readHistory(): Record<string, MealPlanHistoryEntry[]> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(MEAL_PLAN_HISTORY_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, MealPlanHistoryEntry[]>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeHistory(history: Record<string, MealPlanHistoryEntry[]>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MEAL_PLAN_HISTORY_STORAGE_KEY, JSON.stringify(history));
  } catch (error) {
    console.warn("meal plan history localStorage write failed:", error);
  }
}

export function readMealPlanHistoryForMember(memberId: string): MealPlanHistoryEntry[] {
  const id = memberId.trim();
  if (!id) return [];
  const entries = readHistory()[id] ?? [];
  return entries
    .filter((entry) => entry?.plan?.days?.length)
    .sort((a, b) => Date.parse(b.savedAt || "") - Date.parse(a.savedAt || ""));
}

export function notifyMealPlanChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(MEAL_PLAN_CHANGED_EVENT));
}

export function loadMealPlanForMember(memberId: string): MealPlan | null {
  const id = memberId.trim();
  if (!id) return null;
  const stored = readPlans()[id];
  if (!stored?.days?.length) return null;
  return stored;
}

export function persistMealPlan(plan: MealPlan, options?: { notify?: boolean }): void {
  const memberId = plan.memberId.trim();
  if (!memberId) return;
  const all = readPlans();
  const previous = all[memberId];
  const nextPlan = { ...plan, memberId, updatedAt: new Date().toISOString() };
  all[memberId] = nextPlan;
  writePlans(all);
  if (previous?.days?.length && JSON.stringify(previous) !== JSON.stringify(nextPlan)) {
    const history = readHistory();
    const existing = history[memberId] ?? [];
    const snapshot: MealPlanHistoryEntry = {
      id: `hist-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      savedAt: new Date().toISOString(),
      plan: previous,
    };
    history[memberId] = [snapshot, ...existing].slice(0, MAX_HISTORY_PER_MEMBER);
    writeHistory(history);
  }
  if (options?.notify !== false) {
    notifyMealPlanChanged();
  }
}

export function loadOrCreateMealPlanForMember(memberId: string): MealPlan {
  const existing = loadMealPlanForMember(memberId);
  if (existing) return existing;
  const created = createDefaultMealPlan(memberId);
  persistMealPlan(created);
  return created;
}
