import { describe, expect, it } from "vitest";
import {
  assignWeekPlanGroupAndSyncDays,
  buildPeriodPlanWeekNavItemsFromPlan,
  normalizePeriodSchedulePlan,
  normalizeSharedPlanDaysInWeeklyPlans,
  propagatePlanGroupDaysFromWeek,
  resolvePeriodPlanWeek,
} from "./periodPlanMerge";
import type { PeriodSchedulePlan } from "./types";

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

  it("syncs days for weeks with same planGroupKey (lowest week is canonical)", () => {
    const withGroup: PeriodSchedulePlan = {
      id: "plan-1",
      title: "Test",
      notes: "",
      startDate: "2026-01-06",
      weeks: 3,
      createdAt: "2026-01-01",
      weeklyPlans: [
        { id: "w1", weekNumber: 1, days: { ...empty, monday: "A", tuesday: "x" }, planGroupKey: "rose" },
        { id: "w2", weekNumber: 2, days: { ...empty, monday: "B" } },
        { id: "w3", weekNumber: 3, days: { ...empty, monday: "C" }, planGroupKey: "rose" },
      ],
    };
    const normalized = normalizePeriodSchedulePlan(withGroup);
    expect(normalized.weeklyPlans[0].days.monday).toBe("A");
    expect(normalized.weeklyPlans[0].days.tuesday).toBe("x");
    expect(normalized.weeklyPlans[2].days.monday).toBe("A");
    expect(normalized.weeklyPlans[2].days.tuesday).toBe("x");
    expect(normalized.weeklyPlans[1].days.monday).toBe("B");
  });
});

describe("plan group helpers", () => {
  it("assignWeekPlanGroupAndSyncDays copies from lowest week number in group", () => {
    const weeks = [
      { id: "w1", weekNumber: 1, days: { ...empty, monday: "A" }, planGroupKey: "rose" as const },
      { id: "w2", weekNumber: 2, days: { ...empty, monday: "B" } },
      { id: "w3", weekNumber: 3, days: { ...empty, monday: "C" } },
    ];
    const next = assignWeekPlanGroupAndSyncDays(weeks, "w3", "rose");
    expect(next.find((w) => w.id === "w3")?.days.monday).toBe("A");
    expect(next.find((w) => w.id === "w1")?.days.monday).toBe("A");
  });

  it("propagatePlanGroupDaysFromWeek updates siblings", () => {
    const weeks = [
      { id: "w1", weekNumber: 1, days: { ...empty, monday: "A" }, planGroupKey: "rose" },
      { id: "w2", weekNumber: 2, days: { ...empty, monday: "B" }, planGroupKey: "rose" },
    ];
    const edited = weeks.map((w) => (w.id === "w2" ? { ...w, days: { ...w.days, monday: "Z" } } : w));
    const out = propagatePlanGroupDaysFromWeek(edited, "w2");
    expect(out[0].days.monday).toBe("Z");
    expect(out[1].days.monday).toBe("Z");
  });

  it("normalizeSharedPlanDaysInWeeklyPlans runs key by key", () => {
    const weeks = normalizeSharedPlanDaysInWeeklyPlans([
      { id: "a", weekNumber: 1, days: { ...empty, monday: "1" }, planGroupKey: "teal" },
      { id: "b", weekNumber: 2, days: { ...empty, monday: "wrong" }, planGroupKey: "teal" },
    ]);
    expect(weeks[1].days.monday).toBe("1");
  });
});
