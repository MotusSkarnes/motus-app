import { describe, expect, it } from "vitest";
import { createDefaultMealPlan } from "./mealPlanDefaults";
import {
  addMealPlanSnackSlot,
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

  it("legger flere mellommåltider nederst med egne id-er", () => {
    const plan = createDefaultMealPlan("m1", { mealSlotIds: ["frokost", "mellommaltid", "middag"] });
    const next = addMealPlanSnackSlot(plan);
    const meals = next.days[0]!.meals;
    expect(meals.map((meal) => meal.name)).toEqual(["Frokost", "Middag", "Mellommåltid 1", "Mellommåltid 2"]);
    expect(new Set(meals.map((meal) => meal.id)).size).toBe(meals.length);
  });
});
