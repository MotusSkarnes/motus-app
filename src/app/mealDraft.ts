import type { FoodItem } from "./foodBankTypes";
import type { MemberQuickFoodLogEntry } from "./memberMealPlanState";
import {
  createSavedMealFromQuickLogs,
  type MemberSavedMeal,
  type MemberSavedMealItem,
} from "./memberSavedMeals";

export type MealDraftItem = {
  id: string;
  name: string;
  grams: number;
  source: MemberQuickFoodLogEntry["source"];
  nutritionPer100g: MemberQuickFoodLogEntry["nutritionPer100g"];
};

export function createMealDraftItem(food: FoodItem, grams: number): MealDraftItem {
  return {
    id: `draft-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    name: food.name,
    grams,
    source: "food",
    nutritionPer100g: { ...food.nutritionPer100g },
  };
}

export function mealDraftItemFromSaved(item: MemberSavedMealItem, index: number): MealDraftItem {
  return {
    id: `draft-${Date.now().toString(36)}-${index}-${Math.random().toString(36).slice(2, 5)}`,
    name: item.name,
    grams: item.grams,
    source: item.source,
    nutritionPer100g: { ...item.nutritionPer100g },
  };
}

export function mealDraftItemsFromSavedMeal(meal: MemberSavedMeal): MealDraftItem[] {
  return meal.items.map((item, index) => mealDraftItemFromSaved(item, index));
}

export function draftToQuickLogEntry(item: MealDraftItem, mealId: string): MemberQuickFoodLogEntry {
  return {
    id: `log-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    name: item.name,
    grams: item.grams,
    source: item.source,
    mealId: mealId.trim(),
    loggedAt: new Date().toISOString(),
    nutritionPer100g: { ...item.nutritionPer100g },
  };
}

export function draftItemsToPseudoLogs(items: MealDraftItem[]): MemberQuickFoodLogEntry[] {
  return items.map((item, index) => ({
    id: item.id || `preview-${index}`,
    name: item.name,
    grams: item.grams,
    source: item.source,
    loggedAt: "",
    nutritionPer100g: item.nutritionPer100g,
  }));
}

export function createSavedMealFromDraft(
  items: MealDraftItem[],
  name: string,
  mealSlotId?: string,
): MemberSavedMeal {
  const pseudo = items.map((item, index) => draftToQuickLogEntry(item, mealSlotId ?? `draft-${index}`));
  return createSavedMealFromQuickLogs(pseudo, name, mealSlotId);
}

export function defaultDraftMealName(items: MealDraftItem[], slotLabel: string): string {
  if (!items.length) return slotLabel;
  if (items.length === 1) return items[0]!.name;
  return `${items[0]!.name} m.m.`;
}
