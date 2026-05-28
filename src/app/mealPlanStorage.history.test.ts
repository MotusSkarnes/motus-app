import { beforeEach, describe, expect, it } from "vitest";
import { createDefaultMealPlan } from "./mealPlanDefaults";
import {
  MEAL_PLAN_HISTORY_STORAGE_KEY,
  MEAL_PLANS_STORAGE_KEY,
  persistMealPlan,
  readMealPlanHistoryForMember,
} from "./mealPlanStorage";

describe("mealPlanStorage history", () => {
  beforeEach(() => {
    window.localStorage.removeItem(MEAL_PLANS_STORAGE_KEY);
    window.localStorage.removeItem(MEAL_PLAN_HISTORY_STORAGE_KEY);
  });

  it("stores previous version as history snapshot when plan changes", () => {
    const plan = createDefaultMealPlan("member-1");
    persistMealPlan(plan, { notify: false });

    const updated = {
      ...plan,
      notes: "Ny notattekst",
    };
    persistMealPlan(updated, { notify: false });

    const history = readMealPlanHistoryForMember("member-1");
    expect(history).toHaveLength(1);
    expect(history[0]?.plan.notes).toBe("");
  });
});
