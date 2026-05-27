import { createDefaultMealPlan } from "./mealPlanDefaults";
import type { MealPlan } from "./mealPlanTypes";

export const MEAL_PLANS_STORAGE_KEY = "motus_meal_plans_v1";
export const MEAL_PLAN_CHANGED_EVENT = "motus-meal-plan-changed";

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
  window.localStorage.setItem(MEAL_PLANS_STORAGE_KEY, JSON.stringify(plans));
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
  all[memberId] = { ...plan, memberId, updatedAt: new Date().toISOString() };
  writePlans(all);
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
