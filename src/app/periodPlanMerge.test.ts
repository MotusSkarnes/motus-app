import { describe, expect, it } from "vitest";
import {
  buildPeriodPlanWeekNavItemsFromPlan,
  normalizePeriodSchedulePlan,
  resolvePeriodPlanWeek,
} from "./periodPlanMerge";
import type { PeriodSchedulePlan } from "./types";

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
      { id: "w1", weekNumber: 1, days: { monday: "A", tuesday: "", wednesday: "", thursday: "", friday: "", saturday: "", sunday: "" } },
      { id: "w2", weekNumber: 2, days: { monday: "B", tuesday: "", wednesday: "", thursday: "", friday: "", saturday: "", sunday: "" } },
    ]);
    expect(resolvePeriodPlanWeek(plan, 2)?.days.monday).toBe("B");
  });

  it("falls back to index when weekNumber is missing", () => {
    const plan = makePlan([
      { id: "w1", weekNumber: 0, days: { monday: "A", tuesday: "", wednesday: "", thursday: "", friday: "", saturday: "", sunday: "" } },
      { id: "w2", weekNumber: 0, days: { monday: "B", tuesday: "", wednesday: "", thursday: "", friday: "", saturday: "", sunday: "" } },
    ]);
    const normalized = normalizePeriodSchedulePlan(plan);
    expect(resolvePeriodPlanWeek(normalized, 2)?.days.monday).toBe("B");
  });
});

describe("normalizePeriodSchedulePlan", () => {
  it("assigns sequential week numbers when missing", () => {
    const plan = makePlan([
      { id: "w1", weekNumber: 0, days: { monday: "", tuesday: "", wednesday: "", thursday: "", friday: "", saturday: "", sunday: "" } },
      { id: "w2", weekNumber: 0, days: { monday: "", tuesday: "", wednesday: "", thursday: "", friday: "", saturday: "", sunday: "" } },
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
      weeklyPlans: [
        { id: "w1", weekNumber: 1, days: { monday: "A", tuesday: "", wednesday: "", thursday: "", friday: "", saturday: "", sunday: "" } },
      ],
    };
    const normalized = normalizePeriodSchedulePlan(plan);
    expect(normalized.weeklyPlans).toHaveLength(4);
    expect(buildPeriodPlanWeekNavItemsFromPlan(normalized)).toHaveLength(4);
    expect(resolvePeriodPlanWeek(normalized, 3)?.days.monday).toBe("");
  });
});
