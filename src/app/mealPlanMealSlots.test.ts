import { describe, expect, it } from "vitest";
import { createDefaultMealPlan } from "./mealPlanDefaults";
import {
  createMealPlanDaysWithSlots,
  inferMealSlotIdsFromPlan,
  mealNameToSlotId,
  toggleMealPlanSlotId,
} from "./mealPlanMealSlots";

describe("mealPlanMealSlots", () => {
  it("bygger dager med valgte måltider", () => {
    const days = createMealPlanDaysWithSlots(["frokost", "middag", "kvelds"]);
    expect(days[0]?.meals.map((m) => m.name)).toEqual(["Frokost", "Middag", "Kvelds"]);
  });

  it("gjenkjenner snacks som mellommåltid", () => {
    expect(mealNameToSlotId("Snacks")).toBe("mellommaltid");
  });

  it("infererer slots fra eksisterende plan", () => {
    const plan = createDefaultMealPlan("m1");
    expect(inferMealSlotIdsFromPlan(plan)).toEqual(["frokost", "lunsj", "middag", "mellommaltid"]);
  });

  it("lar minst ett måltid være valgt", () => {
    const only = toggleMealPlanSlotId(["frokost"], "frokost");
    expect(only).toEqual(["frokost"]);
  });
});
