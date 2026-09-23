import { describe, expect, it } from "vitest";
import { EMPTY_MEMBER_MEAL_PLAN_STATE, type MemberMealPlanState } from "./memberMealPlanState";
import { mergeMemberMealPlanStateList } from "./memberMealPlanStateCloud";

function state(partial: Partial<MemberMealPlanState>): MemberMealPlanState {
  return { ...EMPTY_MEMBER_MEAL_PLAN_STATE, ...partial };
}

describe("mergeMemberMealPlanStateList", () => {
  it("beholder fullføringer fra alle kundeidentiteter selv om en nyere rad er tom", () => {
    const completed = state({
      loggedMeals: { "2026-09-22": ["breakfast"] },
      loggedFoodIds: { "2026-09-22": ["oats"] },
      updatedAt: "2026-09-22T08:00:00.000Z",
    });
    const newerEmptyAlias = state({ updatedAt: "2026-09-22T09:00:00.000Z" });

    const merged = mergeMemberMealPlanStateList([completed, newerEmptyAlias]);

    expect(merged?.loggedMeals["2026-09-22"]).toEqual(["breakfast"]);
    expect(merged?.loggedFoodIds["2026-09-22"]).toEqual(["oats"]);
  });
});
