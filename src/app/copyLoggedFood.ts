import type { MemberQuickFoodLogEntry } from "./memberMealPlanState";

/** Make independent log entries; copied meals must never reuse source row IDs. */
export function copyLoggedFoodEntries(entries: MemberQuickFoodLogEntry[], mealId?: string): MemberQuickFoodLogEntry[] {
  const loggedAt = new Date().toISOString();
  return entries.map((entry) => ({
    ...entry,
    id: crypto.randomUUID(),
    loggedAt,
    mealId: mealId ?? entry.mealId,
    nutritionPer100g: { ...entry.nutritionPer100g },
  }));
}
