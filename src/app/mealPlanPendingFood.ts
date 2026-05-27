import type { FoodItem } from "./foodBankTypes";

const STORAGE_KEY = "motus.mealPlan.pendingFood";

export type MealPlanPendingFood = {
  memberId: string;
  memberName: string;
  food: FoodItem;
  grams: number;
};

export function setMealPlanPendingFood(pending: MealPlanPendingFood): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(pending));
}

export function peekMealPlanPendingFood(memberId: string): MealPlanPendingFood | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MealPlanPendingFood;
    if (parsed.memberId !== memberId.trim()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function consumeMealPlanPendingFood(memberId: string): MealPlanPendingFood | null {
  const pending = peekMealPlanPendingFood(memberId);
  if (!pending || typeof window === "undefined") return pending;
  window.sessionStorage.removeItem(STORAGE_KEY);
  return pending;
}
