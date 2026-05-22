import { describe, expect, it } from "vitest";
import {
  applyPeriodPlanSwaps,
  getSwapsForWeek,
  periodPlanSourceDay,
  setSwapsForWeek,
  togglePeriodPlanMove,
  togglePeriodPlanSwap,
} from "./periodPlanSwaps";
import type { WeeklyDayPlan } from "./types";

const baseDays: WeeklyDayPlan = {
  monday: "Program A",
  tuesday: "Hvile",
  wednesday: "Program B",
  thursday: "",
  friday: "Program C",
  saturday: "",
  sunday: "",
};

describe("periodPlanSwaps", () => {
  it("swaps content between two days", () => {
    const swaps = togglePeriodPlanSwap([], "tuesday", "wednesday");
    const effective = applyPeriodPlanSwaps(baseDays, swaps);
    expect(effective.tuesday).toBe("Program B");
    expect(effective.wednesday).toBe("Hvile");
  });

  it("toggles swap off when applied twice", () => {
    const once = togglePeriodPlanSwap([], "monday", "tuesday");
    const twice = togglePeriodPlanSwap(once, "monday", "tuesday");
    expect(applyPeriodPlanSwaps(baseDays, twice)).toEqual(baseDays);
  });

  it("moves content to another day without swapping target back", () => {
    const swaps = togglePeriodPlanMove([], "monday", "saturday");
    const effective = applyPeriodPlanSwaps(baseDays, swaps);
    expect(effective.monday).toBe("");
    expect(effective.saturday).toBe("Program A");
  });

  it("move replaces existing target content intentionally", () => {
    const swaps = togglePeriodPlanMove([], "monday", "friday");
    const effective = applyPeriodPlanSwaps(baseDays, swaps);
    expect(effective.monday).toBe("");
    expect(effective.friday).toBe("Program A");
  });

  it("reports source day for moved content", () => {
    const swaps = togglePeriodPlanSwap([], "tuesday", "wednesday");
    const effective = applyPeriodPlanSwaps(baseDays, swaps);
    expect(periodPlanSourceDay("wednesday", baseDays, effective)).toBe("tuesday");
  });

  it("stores swaps per plan and week", () => {
    let state = setSwapsForWeek({}, "plan-1", 2, [{ dayA: "monday", dayB: "friday" }]);
    expect(getSwapsForWeek(state, "plan-1", 2)).toHaveLength(1);
    expect(getSwapsForWeek(state, "plan-1", 1)).toHaveLength(0);
    state = setSwapsForWeek(state, "plan-1", 2, []);
    expect(getSwapsForWeek(state, "plan-1", 2)).toHaveLength(0);
  });
});
