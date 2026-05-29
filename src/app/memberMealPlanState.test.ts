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
});
