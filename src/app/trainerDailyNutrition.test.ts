import { describe, expect, it } from "vitest";
import { EMPTY_MEMBER_MEAL_PLAN_STATE } from "./memberMealPlanState";
import { completedPlanFoodLogsForDate, trainerFoodLogsForDate } from "./trainerDailyNutrition";
import type { MealPlan } from "./mealPlanTypes";

const nutrition = { kcal: 100, protein: 10, carbs: 5, fat: 2, fiber: 1, sugar: 0, saturatedFat: 0, sodium: 0 };
const plan: MealPlan = {
  id: "plan", memberId: "member", title: "Plan", notes: "", createdAt: "2026-01-01",
  days: Array.from({ length: 7 }, (_, day) => ({
    id: `day-${day}`, label: `Dag ${day + 1}`,
    meals: [{ id: `meal-${day}-frokost`, name: "Frokost", items: [{ id: `food-${day}`, foodId: "oats", foodName: "Havregryn", grams: 50, nutritionPer100g: nutrition }] }],
  })),
};

describe("trainer daily nutrition", () => {
  it("viser avhukede planvarer i trenerens I dag-visning", () => {
    const state = { ...EMPTY_MEMBER_MEAL_PLAN_STATE, loggedMeals: { "2026-09-23": ["meal-2-frokost"] } };
    const rows = completedPlanFoodLogsForDate(plan, state, "2026-09-23");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: "Havregryn", grams: 50, mealId: "member-frokost" });
  });

  it("kombinerer planvarer og egne tillegg uten å miste noen", () => {
    const own = { id: "own", name: "Banan", grams: 100, source: "food" as const, loggedAt: "2026-09-23T10:00:00Z", nutritionPer100g: nutrition };
    const state = { ...EMPTY_MEMBER_MEAL_PLAN_STATE, loggedFoodIds: { "2026-09-23": ["food-2"] }, quickFoodLogs: { "2026-09-23": [own] } };
    expect(trainerFoodLogsForDate(plan, state, "2026-09-23").map((row) => row.name)).toEqual(["Havregryn", "Banan"]);
  });
});
