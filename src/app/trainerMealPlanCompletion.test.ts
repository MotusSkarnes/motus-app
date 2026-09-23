import { describe, expect, it } from "vitest";
import { createDefaultMealPlan } from "./mealPlanDefaults";
import { EMPTY_MEMBER_MEAL_PLAN_STATE, mealSwapKey } from "./memberMealPlanState";
import { completedMealRowsForTrainer, latestMealStatusById, mealPlanActivityDateKeys } from "./trainerMealPlanCompletion";

describe("trainerMealPlanCompletion", () => {
  it("shows completed meals and customer changes", () => {
    const plan = createDefaultMealPlan("member-1");
    const breakfast = plan.days[0]!.meals[0]!;
    const lunch = plan.days[1]!.meals[1]!;
    breakfast.items = [{
      id: "planned-1", foodId: "food-1", foodName: "Havregrøt", grams: 300,
      nutritionPer100g: { kcal: 100, protein: 5, carbs: 15, fat: 2, fiber: 3, sugar: 1, saturatedFat: 0.2, sodium: 10 },
    }];
    lunch.items = [{ ...breakfast.items[0]!, id: "replacement-1", foodName: "Salat" }];
    const dateKey = "2026-09-23";
    const state = {
      ...EMPTY_MEMBER_MEAL_PLAN_STATE,
      loggedMeals: { [dateKey]: [breakfast.id] },
      mealSwaps: { [mealSwapKey(dateKey, breakfast.id)]: { sourceDayId: plan.days[1]!.id, sourceMealId: lunch.id } },
      skippedFoodIds: { [dateKey]: ["replacement-1"] },
      ingredientSwaps: { [`${dateKey}:${breakfast.id}:ing-0`]: { foodId: "food-2", grams: 125 } },
      quickFoodLogs: { [dateKey]: [{
        id: "extra-1", name: "Eple", grams: 100, source: "food" as const, mealId: breakfast.id,
        loggedAt: "2026-09-23T08:00:00Z",
        nutritionPer100g: { kcal: 50, protein: 0, carbs: 12, fat: 0, fiber: 2, sugar: 10, saturatedFat: 0, sodium: 0 },
      }] },
    };

    const rows = completedMealRowsForTrainer(plan, state, dateKey);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.displayTitle).toBe("Salat");
    expect(rows[0]?.changeLabels).toEqual(["Byttet måltid", "1 planvare fjernet", "1 egen matvare lagt til", "1 ingrediens byttet"]);
    expect(mealPlanActivityDateKeys(state)).toContain(dateKey);
    expect(latestMealStatusById(plan, state)[breakfast.id]?.label).toBe("Fullført · endret");
  });
});
