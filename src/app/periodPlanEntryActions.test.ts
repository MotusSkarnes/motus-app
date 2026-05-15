import { describe, expect, it } from "vitest";
import type { TrainingProgram } from "./types";
import {
  findProgramForPeriodPlanEntry,
  isGroupPeriodPlanEntry,
  resolveGroupClassNameFromPeriodEntry,
  resolvePeriodPlanEntryAction,
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
    expect(findProgramForPeriodPlanEntry("Gruppetime: Yoga", programs)).toBeNull();
  });

  it("resolves start vs log actions", () => {
    expect(resolvePeriodPlanEntryAction("Styrke A", programs).kind).toBe("start-program");
    expect(resolvePeriodPlanEntryAction("Gruppetime: Yoga", programs).kind).toBe("log-group");
    expect(resolvePeriodPlanEntryAction("Hvile / restitusjon", programs).kind).toBe("none");
  });
});
