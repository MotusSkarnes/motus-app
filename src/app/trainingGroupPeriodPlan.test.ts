import { describe, expect, it } from "vitest";
import type { PeriodSchedulePlan, TrainingProgram, WeeklyDayPlan } from "./types";
import {
  buildGroupPeriodPlanCopy,
  collectGroupPeriodPlanOptions,
  findGroupPeriodPlanCopy,
  planGroupPeriodPlanSync,
  snapshotPeriodPlanForGroup,
  upsertGroupPeriodPlanInLocalMap,
  parseGroupMasterPeriodPlan,
} from "./trainingGroupPeriodPlan";

function days(partial: Partial<WeeklyDayPlan>): WeeklyDayPlan {
  return {
    monday: "",
    tuesday: "",
    wednesday: "",
    thursday: "",
    friday: "",
    saturday: "",
    sunday: "",
    ...partial,
  };
}

function plan(partial: Partial<PeriodSchedulePlan> = {}): PeriodSchedulePlan {
  return {
    id: "plan-1",
    title: "Løpeuke",
    notes: "",
    startDate: "2026-09-14",
    weeks: 1,
    createdAt: "14.09.2026",
    weeklyPlans: [
      {
        id: "w1",
        weekNumber: 1,
        days: days({ monday: "SUB45 · Styrke løper", wednesday: "Hvile / restitusjon" }),
      },
    ],
    periodPlanAddedBy: "trainer",
    ...partial,
  };
}

function program(partial: Partial<TrainingProgram> = {}): TrainingProgram {
  return {
    id: "p1",
    memberId: "__template__",
    title: "SUB45 · Styrke løper",
    goal: "",
    notes: "",
    createdAt: "14.09.2026",
    exercises: [],
    ...partial,
  };
}

describe("trainingGroupPeriodPlan", () => {
  it("keeps a filled ukeplan snapshot and tags member copies with the group", () => {
    const snapshot = snapshotPeriodPlanForGroup(plan());
    expect(snapshot.title).toBe("Løpeuke");
    expect(snapshot.trainingGroupId).toBeUndefined();
    const copy = buildGroupPeriodPlanCopy(snapshot, { id: "g1", sourcePeriodPlanId: "plan:plan-1" });
    expect(copy.trainingGroupId).toBe("g1");
    expect(copy.trainingGroupMasterPlanId).toBe("plan:plan-1");
    expect(copy.periodPlanAddedBy).toBe("trainer");
    expect(copy.id).not.toBe(snapshot.id);
    expect(findGroupPeriodPlanCopy([copy], "g1")?.id).toBe(copy.id);
  });

  it("reuses the existing member copy id when the group ukeplan is updated", () => {
    const existing = buildGroupPeriodPlanCopy(plan(), { id: "g1", sourcePeriodPlanId: "src" });
    const updated = buildGroupPeriodPlanCopy(
      snapshotPeriodPlanForGroup(plan({ title: "Løpeuke v2" })),
      { id: "g1", sourcePeriodPlanId: "src" },
      existing,
    );
    expect(updated.id).toBe(existing.id);
    expect(updated.title).toBe("Løpeuke v2");
  });

  it("builds one ukeplan copy per group member", () => {
    const result = planGroupPeriodPlanSync({
      group: {
        id: "g1",
        memberIds: ["m1", "m2"],
        sourcePeriodPlanId: "plan:plan-1",
        masterPeriodPlan: snapshotPeriodPlanForGroup(plan()),
      },
      plansByMemberId: {
        m1: [buildGroupPeriodPlanCopy(plan(), { id: "g1", sourcePeriodPlanId: "plan:plan-1" })],
      },
    });
    expect(result.missingSnapshot).toBe(false);
    expect(result.copies.map((row) => row.memberId)).toEqual(["m1", "m2"]);
    expect(result.copies[0]?.plan.id).toBeDefined();
    expect(result.copies[1]?.plan.id).not.toBe(result.copies[0]?.plan.id);
  });

  it("lists Utforsk running plans and client ukeplaner, skipping empty and group copies", () => {
    const options = collectGroupPeriodPlanOptions({
      plansByMemberId: {
        m1: [
          plan({ id: "client-plan", title: "Ada sin uke" }),
          plan({ id: "group-copy", title: "Gruppeplan", trainingGroupId: "g1" }),
          plan({
            id: "empty",
            title: "Tom",
            weeklyPlans: [{ id: "w", weekNumber: 1, days: days({}) }],
          }),
        ],
      },
      members: [{ id: "m1", name: "Ada" }],
      programs: [program()],
    });
    expect(options.some((option) => option.label.startsWith("Utforsk:"))).toBe(true);
    const client = options.find((option) => option.id === "plan:client-plan");
    expect(client?.label).toContain("Ada");
    expect(client?.programs.some((row) => row.title === "SUB45 · Styrke løper")).toBe(true);
    expect(options.some((option) => option.id === "plan:group-copy")).toBe(false);
    expect(options.some((option) => option.id === "plan:empty")).toBe(false);
  });

  it("replaces the previous group ukeplan for a member in local storage", () => {
    const first = buildGroupPeriodPlanCopy(plan(), { id: "g1", sourcePeriodPlanId: "src" });
    const second = buildGroupPeriodPlanCopy(plan({ title: "Ny" }), { id: "g1", sourcePeriodPlanId: "src" });
    const next = upsertGroupPeriodPlanInLocalMap({ m1: [first] }, ["m1"], second);
    expect(next.m1).toHaveLength(1);
    expect(next.m1?.[0]?.id).toBe(second.id);
    expect(next.m1?.[0]?.title).toBe("Ny");
  });

  it("parses wrapped group ukeplan snapshots from the cloud payload", () => {
    const wrapped = parseGroupMasterPeriodPlan({
      plan: plan(),
      programs: [{ title: "SUB45 · Styrke løper", goal: "", notes: "", exercises: [] }],
    });
    expect(wrapped.plan?.title).toBe("Løpeuke");
    expect(wrapped.programs).toHaveLength(1);
    expect(parseGroupMasterPeriodPlan(plan()).plan?.id).toBe("plan-1");
  });
});
