import { describe, expect, it } from "vitest";
import {
  applyPeriodPlanSwaps,
  buildPeriodPlanWeekOverride,
  getSwapsForWeek,
  mergePeriodPlanSwapPrefs,
  mergePeriodPlanSwapsIntoPersonalGoals,
  periodPlanSourceDay,
  readPeriodPlanSwapsFromPersonalGoals,
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

  it("stores concrete week override so the visible result is deterministic", () => {
    const nextDays: WeeklyDayPlan = { ...baseDays, monday: "", saturday: "Program A" };
    const overrides = buildPeriodPlanWeekOverride(baseDays, nextDays, "monday", "saturday");
    expect(applyPeriodPlanSwaps(baseDays, overrides)).toEqual(nextDays);
  });

  it("stores a single-day program replacement as a week override", () => {
    const nextDays: WeeklyDayPlan = { ...baseDays, wednesday: "Program D" };
    const overrides = buildPeriodPlanWeekOverride(baseDays, nextDays, "wednesday", "wednesday");
    expect(applyPeriodPlanSwaps(baseDays, overrides).wednesday).toBe("Program D");
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

  it("round-trips period plan swaps in personal goals", () => {
    const swapsByPlan = setSwapsForWeek({}, "plan-1", 3, buildPeriodPlanWeekOverride(baseDays, { ...baseDays, friday: "Program D" }, "friday", "friday"));
    const encoded = mergePeriodPlanSwapsIntoPersonalGoals("", {
      version: 1,
      swapsByPlan,
      updatedAt: 1234,
    });
    const read = readPeriodPlanSwapsFromPersonalGoals(encoded);
    expect(read?.updatedAt).toBe(1234);
    expect(applyPeriodPlanSwaps(baseDays, getSwapsForWeek(read?.swapsByPlan ?? {}, "plan-1", 3)).friday).toBe("Program D");
  });

  it("prefers newer period plan swaps when merging local and remote", () => {
    const localSwaps = setSwapsForWeek({}, "plan-1", 1, [{ dayA: "monday", dayB: "tuesday", mode: "swap" }]);
    const remoteSwaps = setSwapsForWeek({}, "plan-1", 1, [{ dayA: "wednesday", dayB: "thursday", mode: "swap" }]);
    const merged = mergePeriodPlanSwapPrefs(
      { version: 1, swapsByPlan: localSwaps, updatedAt: 100 },
      { version: 1, swapsByPlan: remoteSwaps, updatedAt: 200 },
    );
    expect(getSwapsForWeek(merged.swapsByPlan, "plan-1", 1)[0]?.dayA).toBe("wednesday");
  });
});
