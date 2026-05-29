import type { FoodItem } from "../../app/foodBankTypes";
import type { SelfLogDraft } from "./InlineMealSelfLog";

export function createSelfLogEntry(food: FoodItem, grams: number, mealId: string): SelfLogDraft {
  return {
    name: food.name,
    grams: Math.round(grams),
    source: "food",
    mealId,
    nutritionPer100g: { ...food.nutritionPer100g },
  };
}
