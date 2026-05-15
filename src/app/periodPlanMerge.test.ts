import { describe, expect, it } from "vitest";
import {
  buildPeriodPlanWeekNavItemsFromPlan,
  normalizePeriodSchedulePlan,
  resolvePeriodPlanWeek,
  syncGradientMarkedWeekDays,
} from "./periodPlanMerge";
import type { PeriodSchedulePlan, WeeklySchedulePlan } from "./types";

const empty = { monday: "", tuesday: "", wednesday: "", thursday: "", friday: "", saturday: "", sunday: "" };

function makePlan(weeklyPlans: PeriodSchedulePlan["weeklyPlans"]): PeriodSchedulePlan {
  return {
    id: "plan-1",
    title: "Test",
    notes: "",
    startDate: "2026-01-06",
    weeks: weeklyPlans.length,
    createdAt: "2026-01-01",
    weeklyPlans,
  };
}

describe("resolvePeriodPlanWeek", () => {
  it("finds week by weekNumber", () => {
    const plan = makePlan([
      { id: "w1", weekNumber: 1, days: { ...empty, monday: "A" } },
      { id: "w2", weekNumber: 2, days: { ...empty, monday: "B" } },
    ]);
    expect(resolvePeriodPlanWeek(plan, 2)?.days.monday).toBe("B");
  });

  it("falls back to index when weekNumber is missing", () => {
    const plan = makePlan([
      { id: "w1", weekNumber: 0, days: { ...empty, monday: "A" } },
      { id: "w2", weekNumber: 0, days: { ...empty, monday: "B" } },
    ]);
    const normalized = normalizePeriodSchedulePlan(plan);
    expect(resolvePeriodPlanWeek(normalized, 2)?.days.monday).toBe("B");
  });
});

describe("normalizePeriodSchedulePlan", () => {
  it("assigns sequential week numbers when missing", () => {
    const plan = makePlan([
      { id: "w1", weekNumber: 0, days: { ...empty } },
      { id: "w2", weekNumber: 0, days: { ...empty } },
    ]);
    const normalized = normalizePeriodSchedulePlan(plan);
    expect(normalized.weeklyPlans.map((week) => week.weekNumber)).toEqual([1, 2]);
  });

  it("pads weeklyPlans to match plan.weeks", () => {
    const plan: PeriodSchedulePlan = {
      id: "plan-1",
      title: "Test",
      notes: "",
      startDate: "2026-01-06",
      weeks: 4,
      createdAt: "2026-01-01",
      weeklyPlans: [{ id: "w1", weekNumber: 1, days: { ...empty, monday: "A" } }],
    };
    const normalized = normalizePeriodSchedulePlan(plan);
    expect(normalized.weeklyPlans).toHaveLength(4);
    expect(buildPeriodPlanWeekNavItemsFromPlan(normalized)).toHaveLength(4);
    expect(resolvePeriodPlanWeek(normalized, 3)?.days.monday).toBe("");
  });

  it("syncs days for weeks marked usesGradientPlan (lowest week is canonical)", () => {
    const withGradient: PeriodSchedulePlan = {
      id: "plan-1",
      title: "Test",
      notes: "",
      startDate: "2026-01-06",
      weeks: 3,
      createdAt: "2026-01-01",
      weeklyPlans: [
        { id: "w1", weekNumber: 1, days: { ...empty, monday: "A", tuesday: "x" }, usesGradientPlan: true },
        { id: "w2", weekNumber: 2, days: { ...empty, monday: "B" } },
        { id: "w3", weekNumber: 3, days: { ...empty, monday: "C" }, usesGradientPlan: true },
      ],
    };
    const normalized = normalizePeriodSchedulePlan(withGradient);
    expect(normalized.weeklyPlans[0].days.monday).toBe("A");
    expect(normalized.weeklyPlans[0].days.tuesday).toBe("x");
    expect(normalized.weeklyPlans[2].days.monday).toBe("A");
    expect(normalized.weeklyPlans[2].days.tuesday).toBe("x");
    expect(normalized.weeklyPlans[1].days.monday).toBe("B");
  });
});

describe("syncGradientMarkedWeekDays", () => {
  it("aligns marked weeks to canonical days by lowest week number", () => {
    const weeks: WeeklySchedulePlan[] = [
      { id: "w1", weekNumber: 1, days: { ...empty, monday: "A" }, usesGradientPlan: true },
      { id: "w2", weekNumber: 2, days: { ...empty, monday: "B" } },
      { id: "w3", weekNumber: 3, days: { ...empty, monday: "C" }, usesGradientPlan: true },
    ];
    const out = syncGradientMarkedWeekDays(weeks);
    expect(out[0].days.monday).toBe("A");
    expect(out[2].days.monday).toBe("A");
    expect(out[1].days.monday).toBe("B");
  });

  it("no marked weeks leaves copy per week untouched", () => {
    const weeks: WeeklySchedulePlan[] = [
      { id: "a", weekNumber: 1, days: { ...empty, monday: "1" } },
      { id: "b", weekNumber: 2, days: { ...empty, monday: "2" } },
    ];
    const out = syncGradientMarkedWeekDays(weeks);
    expect(out[0].days.monday).toBe("1");
    expect(out[1].days.monday).toBe("2");
  });
});
