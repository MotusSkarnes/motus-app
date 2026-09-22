import { describe, expect, it } from "vitest";
import { copyLoggedFoodEntries } from "./copyLoggedFood";
import type { MemberQuickFoodLogEntry } from "./memberMealPlanState";

describe("copyLoggedFoodEntries", () => {
  it("creates independent entries while preserving portions and nutrition", () => {
    const source: MemberQuickFoodLogEntry = {
      id: "original", name: "Egg", grams: 100, source: "food", mealId: "breakfast", loggedAt: "2026-09-20T08:00:00Z",
      nutritionPer100g: { kcal: 140, protein: 13, carbs: 1, fat: 10, fiber: 0, sugar: 0, saturatedFat: 3, sodium: 120 },
    };
    const [copy] = copyLoggedFoodEntries([source]);
    expect(copy.id).not.toBe(source.id);
    expect(copy.grams).toBe(100);
    expect(copy.mealId).toBe("breakfast");
    expect(copy.nutritionPer100g).toEqual(source.nutritionPer100g);
    expect(copy.nutritionPer100g).not.toBe(source.nutritionPer100g);
  });
});
