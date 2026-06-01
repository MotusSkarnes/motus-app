import { beforeEach, describe, expect, it } from "vitest";
import { createDefaultMealPlan } from "./mealPlanDefaults";
import {
  clearMealPlanLocalForMemberIds,
  loadMealPlanForMember,
  MEAL_PLANS_STORAGE_KEY,
  persistMealPlan,
} from "./mealPlanStorage";

describe("clearMealPlanLocalForMemberIds", () => {
  beforeEach(() => {
    window.localStorage.removeItem(MEAL_PLANS_STORAGE_KEY);
  });

  it("removes plan stored under member id", () => {
    const plan = createDefaultMealPlan("member-a");
    persistMealPlan(plan, { notify: false });
    expect(loadMealPlanForMember("member-a")).not.toBeNull();

    const removed = clearMealPlanLocalForMemberIds(["member-a"], { notify: false });
    expect(removed).toBe(1);
    expect(loadMealPlanForMember("member-a")).toBeNull();
  });
});
