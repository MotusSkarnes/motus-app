import { describe, expect, it } from "vitest";
import {
  buildPeriodPlanWeekNavItemsFromPlan,
  buildPeriodPlanPlannedEntriesByMonth,
  HIDDEN_PERIOD_PLAN_IDS_BY_MEMBER_STORAGE_KEY,
  findPeriodPlanAutoCompleteTargets,
  findPeriodPlanEntryForCalendarDate,
  findTodayPeriodPlanEntryInPlans,
  isMemberOwnedPeriodPlan,
  normalizePeriodSchedulePlan,
  periodPlanEntryMatchesCompletedProgram,
  readActivePeriodPlanIdForMembers,
  readHiddenPeriodPlanIdsForMembers,
  periodPlanWeekdayKeyForDate,
  resolvePeriodPlanWeekNumberForDate,
  writeActivePeriodPlanIdForMembers,
  resolvePeriodPlanPlannedDate,
  resolvePeriodPlanWeek,
  syncGradientMarkedWeekDays,
  writeHiddenPeriodPlanIdsForMembers,
} from "./periodPlanMerge";
import type { PeriodSchedulePlan, TrainingProgram, WeeklySchedulePlan } from "./types";

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
  it("maps calendar day to its actual weekday after plan start", () => {
    const start = new Date(2026, 4, 14);
    const thursday = new Date(2026, 4, 14);
    const tuesday = new Date(2026, 4, 19);
    expect(periodPlanWeekdayKeyForDate(start, thursday)).toBe("thursday");
    expect(periodPlanWeekdayKeyForDate(start, tuesday)).toBe("tuesday");
  });

  it("returns null before plan start", () => {
    const start = new Date(2026, 4, 20);
    const before = new Date(2026, 4, 19);
    expect(periodPlanWeekdayKeyForDate(start, before)).toBeNull();
  });
});

describe("resolvePeriodPlanPlannedDate", () => {
  it("anchors start date on its real weekday", () => {
    const plan = makePlan([{ id: "w1", weekNumber: 1, days: { ...empty } }]);
    plan.startDate = "2026-05-22";
    expect(resolvePeriodPlanPlannedDate(plan, 1, "friday")?.toLocaleDateString("sv-SE")).toBe("2026-05-22");
    expect(resolvePeriodPlanPlannedDate(plan, 1, "sunday")?.toLocaleDateString("sv-SE")).toBe("2026-05-24");
    expect(resolvePeriodPlanPlannedDate(plan, 1, "monday")?.toLocaleDateString("sv-SE")).toBe("2026-05-25");
    expect(resolvePeriodPlanPlannedDate(plan, 2, "monday")?.toLocaleDateString("sv-SE")).toBe("2026-06-01");
  });
});

describe("resolvePeriodPlanWeekNumberForDate", () => {
  it("returns week 2 for day 8–14 after start", () => {
    const plan = makePlan([
      { id: "w1", weekNumber: 1, days: { ...empty, monday: "A" } },
      { id: "w2", weekNumber: 2, days: { ...empty, monday: "B" } },
    ]);
    plan.startDate = "2026-05-19";
    const week = resolvePeriodPlanWeekNumberForDate(plan, new Date(2026, 4, 26));
    expect(week).toBe(2);
  });
});

describe("active period plan storage", () => {
  it("round-trips active plan id per member", () => {
    writeActivePeriodPlanIdForMembers(["member-a"], "plan-xyz");
    expect(readActivePeriodPlanIdForMembers(["member-a"])).toBe("plan-xyz");
    writeActivePeriodPlanIdForMembers(["member-a"], null);
    expect(readActivePeriodPlanIdForMembers(["member-a"])).toBeNull();
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
      new Date(2026, 4, 19),
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

describe("buildPeriodPlanPlannedEntriesByMonth", () => {
  it("builds entries only from the supplied plans", () => {
    const planA = makePlan([{ id: "w1", weekNumber: 1, days: { ...empty, tuesday: "Plan A tirsdag" } }]);
    planA.id = "plan-a";
    planA.startDate = "2026-05-19";

    const planB = makePlan([{ id: "w1", weekNumber: 1, days: { ...empty, tuesday: "Plan B tirsdag" } }]);
    planB.id = "plan-b";
    planB.startDate = "2026-05-19";

    const onlyA = buildPeriodPlanPlannedEntriesByMonth({
      plans: [planA],
      swapsByPlan: {},
      calendarMonth: new Date(2026, 4, 1),
    });
    expect(onlyA.get(19)).toEqual(["Plan A tirsdag"]);

    const onlyB = buildPeriodPlanPlannedEntriesByMonth({
      plans: [planB],
      swapsByPlan: {},
      calendarMonth: new Date(2026, 4, 1),
    });
    expect(onlyB.get(19)).toEqual(["Plan B tirsdag"]);
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
    const match = findPeriodPlanEntryForCalendarDate(plan, new Date(2026, 4, 20));
    expect(match?.entry).toBe("Onsdag i uke 1");
    expect(match?.weekNumber).toBe(1);
    expect(match?.day).toBe("wednesday");
  });

  it("applies day swaps before returning entry", () => {
    const plan = makePlan([{ id: "w1", weekNumber: 1, days: { ...empty, monday: "A", tuesday: "B" } }]);
    plan.startDate = "2026-05-19";
    const swaps = { [plan.id]: { "1": [{ dayA: "monday", dayB: "tuesday" }] } };
    const match = findPeriodPlanEntryForCalendarDate(plan, new Date(2026, 4, 19), swaps);
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

describe("hidden period plans", () => {
  it("updates hidden plan ids for every related member id", () => {
    window.localStorage.setItem(
      HIDDEN_PERIOD_PLAN_IDS_BY_MEMBER_STORAGE_KEY,
      JSON.stringify({ memberA: ["plan-1"], memberB: ["plan-1"] }),
    );

    writeHiddenPeriodPlanIdsForMembers(["memberA", "memberB"], []);

    expect(readHiddenPeriodPlanIdsForMembers(["memberA", "memberB"])).toEqual([]);
  });
});

describe("period plan auto-complete", () => {
  const programs: TrainingProgram[] = [
    {
      id: "p1",
      memberId: "m1",
      title: "Styrke A",
      goal: "",
      notes: "",
      createdAt: "01.01.2026",
      exercises: [],
    },
  ];

  it("matches completed program title to plan entry", () => {
    expect(periodPlanEntryMatchesCompletedProgram("Styrke A", "Styrke A", programs)).toBe(true);
    expect(periodPlanEntryMatchesCompletedProgram("  styrke a ", "Styrke A", programs)).toBe(true);
    expect(periodPlanEntryMatchesCompletedProgram("Kondisjon", "Styrke A", programs)).toBe(false);
  });

  it("finds plan row for today when program is completed", () => {
    const plan = makePlan([{ id: "w1", weekNumber: 1, days: { ...empty, friday: "Styrke A" } }]);
    plan.startDate = "2026-05-22";
    const targets = findPeriodPlanAutoCompleteTargets({
      plans: [plan],
      swapsByPlan: {},
      programTitle: "Styrke A",
      programs,
      completedAt: new Date(2026, 4, 22),
    });
    expect(targets).toEqual([{ planId: "plan-1", weekNumber: 1, day: "friday" }]);
  });
});
