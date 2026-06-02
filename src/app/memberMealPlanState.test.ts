import { describe, expect, it } from "vitest";
import { mergeMemberMealPlanStates, type MemberMealPlanState } from "./memberMealPlanState";

function makeState(partial?: Partial<MemberMealPlanState>): MemberMealPlanState {
  return {
    loggedMeals: {},
    loggedFoodIds: {},
    waterLiters: {},
    checkedShopping: [],
    recipePortions: {},
    mealSwaps: {},
    quickFoodLogs: {},
    skippedFoodIds: {},
    ...partial,
  };
}

describe("mergeMemberMealPlanStates", () => {
  it("beholder recipePortions når tidsstempel er likt", () => {
    const updatedAt = "2026-05-28T10:00:00.000Z";
    const local = makeState({
      updatedAt,
      recipePortions: { "entry-a": 2 },
    });
    const remote = makeState({
      updatedAt,
      recipePortions: { "entry-b": 1.5 },
    });

    const merged = mergeMemberMealPlanStates(local, remote);
    expect(merged.recipePortions).toEqual({
      "entry-b": 1.5,
      "entry-a": 2,
    });
  });

  it("beholder lokale matlogger når sky har nyere tidsstempel", () => {
    const local = makeState({
      updatedAt: "2026-06-02T08:00:00.000Z",
      quickFoodLogs: {
        "2026-06-02": [
          {
            id: "log-1",
            name: "Olden",
            grams: 600,
            source: "food",
            loggedAt: "2026-06-02T09:00:00.000Z",
            nutritionPer100g: {
              kcal: 0,
              protein: 0,
              carbs: 0,
              fat: 0,
              fiber: 0,
              sugar: 0,
              saturatedFat: 0,
              sodium: 0,
              water: 0,
            },
          },
        ],
      },
    });
    const remote = makeState({
      updatedAt: "2026-06-02T10:00:00.000Z",
      quickFoodLogs: {},
    });
    const merged = mergeMemberMealPlanStates(local, remote);
    expect(merged.quickFoodLogs["2026-06-02"]).toHaveLength(1);
  });
});
