import { describe, expect, it } from "vitest";
import { createMealDraftItem, createSavedMealFromDraft, mealDraftItemsFromSavedMeal } from "./mealDraft";
import { createSavedMealFromQuickLogs } from "./memberSavedMeals";
import type { MemberQuickFoodLogEntry } from "./memberMealPlanState";

const food = {
  id: "f1",
  name: "Egg",
  origin: "",
  createdBy: "",
  nutritionPer100g: {
    kcal: 140,
    protein: 12,
    carbs: 1,
    fat: 10,
    fiber: 0,
    sugar: 0,
    saturatedFat: 3,
    sodium: 0,
  },
};

describe("mealDraft", () => {
  it("builds saved meal only from draft items", () => {
    const draft = [createMealDraftItem(food, 100)];
    const saved = createSavedMealFromDraft(draft, "Min frokost", "member-frokost");
    expect(saved.items).toHaveLength(1);
    expect(saved.items[0]?.name).toBe("Egg");
  });

  it("loads saved meal into draft without extra items", () => {
    const log: MemberQuickFoodLogEntry = {
      id: "log-1",
      name: "Egg",
      grams: 100,
      source: "food",
      mealId: "member-frokost",
      loggedAt: "",
      nutritionPer100g: food.nutritionPer100g,
    };
    const saved = createSavedMealFromQuickLogs([log], "Min frokost", "member-frokost");
    const draft = mealDraftItemsFromSavedMeal(saved);
    expect(draft).toHaveLength(1);
  });
});
