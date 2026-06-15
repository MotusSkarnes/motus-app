import { describe, expect, it } from "vitest";
import { buildTrainerPeriodPlanCalendarByMonth, summarizeTrainerCalendarDay } from "./trainerPeriodPlanCalendar";
import type { Member, PeriodSchedulePlan } from "./types";

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
