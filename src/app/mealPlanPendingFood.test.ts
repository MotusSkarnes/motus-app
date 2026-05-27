import { describe, expect, it, beforeEach } from "vitest";
import {
  consumeMealPlanPendingFood,
  peekMealPlanPendingFood,
  setMealPlanPendingFood,
  type MealPlanPendingFood,
} from "./mealPlanPendingFood";
import type { FoodItem } from "./foodBankTypes";

const food: FoodItem = {
  id: "food-1",
  name: "Kylling",
  portionLabel: "100 g",
  portionGrams: 100,
  category: "proteinkilder",
  origin: "Kjøtt",
  source: "egen",
  createdBy: "PT",
  createdAt: "2024-01-01",
  nutritionPer100g: {
    kcal: 165,
    protein: 31,
    carbs: 0,
    fat: 3.6,
    fiber: 0,
    sugar: 0,
    saturatedFat: 0,
    sodium: 0,
  },
};

const pending: MealPlanPendingFood = {
  memberId: "member-1",
  memberName: "Ola",
  food,
  grams: 150,
};

describe("mealPlanPendingFood", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("stores and consumes pending food for the matching member", () => {
    setMealPlanPendingFood(pending);
    expect(peekMealPlanPendingFood("member-1")?.food.name).toBe("Kylling");
    const consumed = consumeMealPlanPendingFood("member-1");
    expect(consumed?.grams).toBe(150);
    expect(peekMealPlanPendingFood("member-1")).toBeNull();
  });

  it("ignores pending food for other members", () => {
    setMealPlanPendingFood(pending);
    expect(peekMealPlanPendingFood("other")).toBeNull();
  });
});
