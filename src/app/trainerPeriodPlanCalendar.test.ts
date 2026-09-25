import { describe, expect, it } from "vitest";
import { buildTrainerPeriodPlanCalendarByMonth, summarizeTrainerCalendarDay } from "./trainerPeriodPlanCalendar";
import type { Member, PeriodSchedulePlan } from "./types";
import { joinPeriodPlanDayEntries, mergePeriodPlanSwapsIntoPersonalGoals } from "./periodPlanSwaps";

const member: Member = {
  id: "m1",
  name: "Kari Nord",
  email: "kari@test.no",
  phone: "",
  birthDate: "",
  goal: "",
  injuries: "",
  focus: "",
  level: "",
  membershipType: "Standard",
  customerType: "PT-kunde",
  daysSinceActivity: "0",
};

const plan: PeriodSchedulePlan = {
  id: "plan-1",
  title: "Mai",
  notes: "",
  startDate: "2026-05-04",
  weeklyPlans: [
    {
      weekNumber: 1,
      days: {
        monday: "Styrke A",
        tuesday: "",
        wednesday: "",
        thursday: "",
        friday: "",
        saturday: "",
        sunday: "",
      },
    },
  ],
};

describe("buildTrainerPeriodPlanCalendarByMonth", () => {
  it("uses the latest plan and the member's changed days", () => {
    const updatedPlan: PeriodSchedulePlan = {
      ...plan,
      trainerSavedAtIso: "2026-05-03T12:00:00Z",
      weeklyPlans: [{ ...plan.weeklyPlans[0], days: { ...plan.weeklyPlans[0].days, monday: "Ny økt" } }],
    };
    const oldPlan: PeriodSchedulePlan = { ...plan, trainerSavedAtIso: "2026-05-01T12:00:00Z" };
    const alias: Member = { ...member, id: "m2", personalGoals: mergePeriodPlanSwapsIntoPersonalGoals("", {
      version: 1, updatedAt: 10,
      swapsByPlan: { [plan.id]: { "1": [{ dayA: "monday", dayB: "tuesday", mode: "swap" }] } },
    }) };
    const { byDay } = buildTrainerPeriodPlanCalendarByMonth({
      members: [member, alias],
      periodPlansByMemberId: { m1: [oldPlan], m2: [updatedPlan] },
      logs: [], calendarMonth: new Date(2026, 4, 1), today: new Date(2026, 4, 1),
    });
    expect(byDay.get(4)?.some((entry) => entry.memberId === "m1")).toBe(false);
    expect(byDay.get(5)?.find((entry) => entry.memberId === "m1")?.entry).toBe("Ny økt");
  });

  it("includes planned entry on matching calendar day", () => {
    const calendarMonth = new Date(2026, 4, 1);
    const { byDay } = buildTrainerPeriodPlanCalendarByMonth({
      members: [member],
      periodPlansByMemberId: { m1: [plan] },
      logs: [],
      calendarMonth,
      today: new Date(2026, 4, 10),
    });

    const entries = Array.from(byDay.values()).flat();
    expect(entries.some((entry) => entry.memberName === "Kari Nord" && entry.entry === "Styrke A")).toBe(true);
  });

  it("shows each session on a shared day without the storage separator", () => {
    const shared: PeriodSchedulePlan = {
      ...plan,
      weeklyPlans: [
        {
          ...plan.weeklyPlans[0],
          days: {
            ...plan.weeklyPlans[0].days,
            monday: joinPeriodPlanDayEntries(["Styrke A", "Mobilitet"]),
          },
        },
      ],
    };
    const { byDay } = buildTrainerPeriodPlanCalendarByMonth({
      members: [member],
      periodPlansByMemberId: { m1: [shared] },
      logs: [],
      calendarMonth: new Date(2026, 4, 1),
      today: new Date(2026, 4, 10),
    });
    const monday = byDay.get(4) ?? [];
    expect(monday.map((entry) => entry.entryLabel)).toEqual(["Styrke A", "Mobilitet"]);
    expect(monday.some((entry) => entry.entryLabel.includes("__motus_period_session__"))).toBe(false);
  });
});

describe("summarizeTrainerCalendarDay", () => {
  it("marks day as planned when active entries exist", () => {
    const summary = summarizeTrainerCalendarDay([
      {
        memberId: "m1",
        memberName: "Kari",
        planId: "p1",
        planTitle: "Mai",
        entry: "Styrke",
        entryLabel: "Økt planlagt",
        status: "planned",
        isPassive: false,
      },
    ]);
    expect(summary.dayStatus).toBe("planned");
    expect(summary.activeCount).toBe(1);
  });
});
