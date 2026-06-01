import { describe, expect, it } from "vitest";
import { createDefaultMealPlan } from "./mealPlanDefaults";
import { pickPreferredMealPlan } from "./mealPlanCloud";
import type { MealPlan } from "./mealPlanTypes";

describe("pickPreferredMealPlan for trainer load", () => {
  it("prefers local plan with food over remote shell with empty meals", () => {
    const memberId = "member-test";
    const remoteShell: MealPlan = {
      ...createDefaultMealPlan(memberId),
      updatedAt: "2020-01-01T00:00:00.000Z",
    };
    const localRich: MealPlan = {
      ...createDefaultMealPlan(memberId),
      days: createDefaultMealPlan(memberId).days.map((day, dayIndex) =>
        dayIndex === 0
          ? {
              ...day,
              meals: day.meals.map((meal, mealIndex) =>
                mealIndex === 0
                  ? {
                      ...meal,
                      items: [
                        {
                          id: "f1",
                          foodId: "food-1",
                          foodName: "Havregryn",
                          grams: 80,
                          nutritionPer100g: { kcal: 370, protein: 13, carbs: 60, fat: 7 },
                        },
                      ],
                    }
                  : meal,
              ),
            }
          : day,
      ),
      updatedAt: "2026-01-01T00:00:00.000Z",
    };

    const preferred = pickPreferredMealPlan([remoteShell, localRich]);
    expect(preferred).toBe(localRich);
  });
});
