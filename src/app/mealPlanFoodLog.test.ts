import { describe, expect, it } from "vitest";
import { sumLoggedMacrosFromFoodItems } from "./mealPlanMacros";
import type { MealPlanDay } from "./mealPlanTypes";
import { EMPTY_MEMBER_MEAL_PLAN_STATE, expandLegacyLoggedFoodIds, syncLoggedMealsFromFoodIds } from "./memberMealPlanState";
import { toggleFoodLogged, toggleMealLogged } from "./memberMealPlanTracking";

const day: MealPlanDay = {
  id: "day-1",
  label: "Mandag",
  meals: [
    {
      id: "meal-1",
      name: "Frokost",
      items: [
        {
          id: "food-1",
          foodId: "f1",
          foodName: "Egg",
          grams: 100,
          nutritionPer100g: { kcal: 155, protein: 13, carbs: 1, fat: 11, fiber: 0, sugar: 0, saturatedFat: 0, sodium: 0 },
        },
        {
          id: "food-2",
          foodId: "f2",
          foodName: "Brød",
          grams: 50,
          nutritionPer100g: { kcal: 247, protein: 9, carbs: 43, fat: 3.5, fiber: 0, sugar: 0, saturatedFat: 0, sodium: 0 },
        },
      ],
    },
  ],
};

describe("meal plan food logging", () => {
  it("summerer kun loggete matvarer til makroer", () => {
    const macros = sumLoggedMacrosFromFoodItems(day, new Set(["food-1"]));
    expect(macros.kcal).toBeCloseTo(155, 0);
    expect(macros.protein).toBeCloseTo(13, 0);
  });

  it("utvider eldre loggedMeals til loggedFoodIds", () => {
    const state = expandLegacyLoggedFoodIds(
      { ...EMPTY_MEMBER_MEAL_PLAN_STATE, loggedMeals: { "2026-05-27": ["meal-1"] } },
      "2026-05-27",
      day.meals,
    );
    expect(state.loggedFoodIds["2026-05-27"]).toEqual(["food-1", "food-2"]);
  });

  it("toggle matvare oppdaterer loggedMeals når måltid er komplett", () => {
    let state = EMPTY_MEMBER_MEAL_PLAN_STATE;
    state = toggleFoodLogged("m1", state, "2026-05-27", day.meals, "food-1");
    state = toggleFoodLogged("m1", state, "2026-05-27", day.meals, "food-2");
    expect(state.loggedMeals["2026-05-27"]).toEqual(["meal-1"]);
    state = toggleFoodLogged("m1", state, "2026-05-27", day.meals, "food-2");
    state = syncLoggedMealsFromFoodIds(state, "2026-05-27", day.meals);
    expect(state.loggedMeals["2026-05-27"]).toEqual([]);
  });

  it("toggle måltid logger alle matvarer", () => {
    const meal = day.meals[0];
    const state = toggleMealLogged("m1", EMPTY_MEMBER_MEAL_PLAN_STATE, "2026-05-27", meal.id, meal, day.meals);
    expect(state.loggedFoodIds["2026-05-27"]).toEqual(["food-1", "food-2"]);
  });
});
