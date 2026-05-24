import { describe, expect, it } from "vitest";
import type { PeriodSchedulePlan, TrainingProgram } from "./types";
import {
  buildPeriodPlanLinkedProgramIdSet,
  findPeriodPlanForProgram,
  findProgramForPeriodPlanEntry,
  isGroupPeriodPlanEntry,
  isPeriodPlanEntryDateInFuture,
  resolveGroupClassNameFromPeriodEntry,
  resolvePeriodPlanEntryAction,
  getPeriodPlanDayListLabel,
} from "./periodPlanEntryActions";

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

describe("periodPlanEntryActions", () => {
  it("detects group entries", () => {
    expect(isGroupPeriodPlanEntry("Gruppetime: Yoga")).toBe(true);
    expect(isGroupPeriodPlanEntry("Gruppetime")).toBe(true);
    expect(isGroupPeriodPlanEntry("Styrke A")).toBe(false);
  });

  it("extracts group class name without double prefix", () => {
    expect(resolveGroupClassNameFromPeriodEntry("Gruppetime: Yoga")).toBe("Yoga");
    expect(resolveGroupClassNameFromPeriodEntry("Gruppetime")).toBe("Smilepuls");
  });

  it("matches program by title", () => {
    expect(findProgramForPeriodPlanEntry("Styrke A", programs)?.id).toBe("p1");
    expect(findProgramForPeriodPlanEntry("  styrke a ", programs)?.id).toBe("p1");
    expect(findProgramForPeriodPlanEntry("Gruppetime: Yoga", programs)).toBeNull();
  });

  it("matches program when period plan label differs slightly from title", () => {
    const intervalPrograms: TrainingProgram[] = [
      {
        id: "p-interval",
        memberId: "m1",
        title: "4x4 intervall",
        goal: "",
        notes: "",
        createdAt: "01.01.2026",
        exercises: [],
      },
    ];
    expect(findProgramForPeriodPlanEntry("Intervall 4x4", intervalPrograms)?.id).toBe("p-interval");
    expect(findProgramForPeriodPlanEntry("4x4 Intervall.", intervalPrograms)?.id).toBe("p-interval");
  });

  it("matches hidden library programs for dagens plan start", () => {
    const hiddenProgram: TrainingProgram = {
      ...programs[0],
      id: "p-hidden",
      memberLibraryStatus: "hidden",
    };
    expect(findProgramForPeriodPlanEntry("Styrke A", [hiddenProgram])?.id).toBe("p-hidden");
  });

  it("resolves start vs log actions", () => {
    expect(resolvePeriodPlanEntryAction("Styrke A", programs).kind).toBe("start-program");
    expect(resolvePeriodPlanEntryAction("Gruppetime: Yoga", programs).kind).toBe("log-group");
    expect(resolvePeriodPlanEntryAction("Hvile / restitusjon", programs).kind).toBe("none");
  });

  it("summarizes list labels without full workout text", () => {
    expect(getPeriodPlanDayListLabel("Styrke A", resolvePeriodPlanEntryAction("Styrke A", programs))).toBe("Økt planlagt");
    expect(getPeriodPlanDayListLabel("Gruppetime: Yoga", resolvePeriodPlanEntryAction("Gruppetime: Yoga", programs))).toBe(
      "Gruppetime: Yoga",
    );
    expect(getPeriodPlanDayListLabel("Gruppetime", resolvePeriodPlanEntryAction("Gruppetime", programs))).toBe(
      "Gruppetime: Smilepuls",
    );
    expect(getPeriodPlanDayListLabel("Hvile / restitusjon", resolvePeriodPlanEntryAction("Hvile / restitusjon", programs))).toBe(
      "Hvile",
    );
  });

  it("builds linked program ids from period plan entries", () => {
    const periodPlans: PeriodSchedulePlan[] = [
      {
        id: "plan-1",
        title: "SUB60",
        notes: "",
        startDate: "01.01.2026",
        weeks: 1,
        createdAt: "01.01.2026",
        weeklyPlans: [
          {
            id: "w1",
            weekNumber: 1,
            days: { monday: "Styrke A", tuesday: "Hvile / restitusjon", wednesday: "", thursday: "", friday: "", saturday: "", sunday: "" },
          },
        ],
      },
    ];
    expect(buildPeriodPlanLinkedProgramIdSet(periodPlans, programs)).toEqual(new Set(["p1"]));
    expect(findPeriodPlanForProgram(programs[0], periodPlans, programs)?.id).toBe("plan-1");
  });

  it("blocks future plan dates for completion", () => {
    const now = new Date(2026, 4, 16);
    expect(isPeriodPlanEntryDateInFuture("17.05.2026", now)).toBe(true);
    expect(isPeriodPlanEntryDateInFuture("16.05.2026", now)).toBe(false);
    expect(isPeriodPlanEntryDateInFuture("15.05.2026", now)).toBe(false);
    expect(isPeriodPlanEntryDateInFuture(null, now)).toBe(false);
  });
});
