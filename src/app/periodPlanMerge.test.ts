import { describe, expect, it } from "vitest";
import {
  buildPeriodPlanWeekNavItemsFromPlan,
  findPeriodPlanEntryForCalendarDate,
  findTodayPeriodPlanEntryInPlans,
  isMemberOwnedPeriodPlan,
  normalizePeriodSchedulePlan,
  periodPlanWeekdayKeyForDate,
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

describe("periodPlanWeekdayKeyForDate", () => {
  it("maps calendar day to plan column from start date (not calendar weekday label)", () => {
    const start = new Date(2026, 4, 14);
    const wednesday = new Date(2026, 4, 14);
    const tuesday = new Date(2026, 4, 19);
    expect(periodPlanWeekdayKeyForDate(start, wednesday)).toBe("monday");
    expect(periodPlanWeekdayKeyForDate(start, tuesday)).toBe("saturday");
  });

  it("returns null before plan start", () => {
    const start = new Date(2026, 4, 20);
    const before = new Date(2026, 4, 19);
    expect(periodPlanWeekdayKeyForDate(start, before)).toBeNull();
  });
});

describe("findTodayPeriodPlanEntryInPlans", () => {
  it("prefers plan with entry on today when active plan id points to empty plan", () => {
    const active = makePlan([{ id: "w1", weekNumber: 1, days: { ...empty, monday: "" } }]);
    active.id = "active-empty";
    active.startDate = "2026-05-19";
    const withEntry = makePlan([{ id: "w1", weekNumber: 1, days: { ...empty, monday: "Styrke A", tuesday: "Styrke B" } }]);
    withEntry.id = "has-entry";
    withEntry.startDate = "2026-05-19";
    const match = findTodayPeriodPlanEntryInPlans(
      [active, withEntry],
      new Date(2026, 4, 20),
      {},
      "active-empty",
      1,
      "tuesday",
    );
    expect(match?.plan.id).toBe("has-entry");
    expect(match?.entry).toBe("Styrke B");
  });

  it("falls back to active week column when start date is missing", () => {
    const plan = makePlan([{ id: "w1", weekNumber: 1, days: { ...empty, wednesday: "Kondisjon" } }]);
    plan.startDate = "";
    const match = findTodayPeriodPlanEntryInPlans([plan], new Date(2026, 4, 20), {}, plan.id, 1, "wednesday");
    expect(match?.entry).toBe("Kondisjon");
  });
});

describe("findPeriodPlanEntryForCalendarDate", () => {
  it("finds entry by planned calendar date across week columns", () => {
    const plan = makePlan([
      {
        id: "w1",
        weekNumber: 1,
        days: { ...empty, monday: "Startdag", wednesday: "Onsdag i uke 1" },
      },
      { id: "w2", weekNumber: 2, days: { ...empty, monday: "Uke 2 mandag" } },
    ]);
    plan.startDate = "14.05.2026";
    const match = findPeriodPlanEntryForCalendarDate(plan, new Date(2026, 4, 16));
    expect(match?.entry).toBe("Onsdag i uke 1");
    expect(match?.weekNumber).toBe(1);
    expect(match?.day).toBe("wednesday");
  });

  it("applies day swaps before returning entry", () => {
    const plan = makePlan([{ id: "w1", weekNumber: 1, days: { ...empty, monday: "A", tuesday: "B" } }]);
    plan.startDate = "2026-05-19";
    const swaps = { [plan.id]: { "1": [{ dayA: "monday", dayB: "tuesday" }] } };
    const match = findPeriodPlanEntryForCalendarDate(plan, new Date(2026, 4, 20), swaps);
    expect(match?.entry).toBe("A");
    expect(match?.day).toBe("tuesday");
  });
});

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

describe("isMemberOwnedPeriodPlan", () => {
  const trainerIds = new Set(["trainer-plan-1"]);

  it("treats explicit member flag as member-owned", () => {
    expect(isMemberOwnedPeriodPlan({ ...makePlan([]), periodPlanAddedBy: "member" }, trainerIds)).toBe(true);
  });

  it("treats remote trainer plans as not member-owned", () => {
    expect(isMemberOwnedPeriodPlan({ ...makePlan([]), id: "trainer-plan-1", periodPlanAddedBy: "trainer" }, trainerIds)).toBe(
      false,
    );
  });

  it("detects inspiration suffix ids as member-owned", () => {
    expect(isMemberOwnedPeriodPlan({ ...makePlan([]), id: "inspo-period-abc-1715789012345" }, trainerIds)).toBe(true);
  });
});
