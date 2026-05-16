import { describe, expect, it } from "vitest";
import {
  buildCelebrationCopy,
  buildProgressGoals,
  buildStreakSubline,
  computeAchievedLevel,
  computeMemberProgressState,
  computeStreakWeeks,
  getProgressStepLabel,
  getWeekKey,
} from "./memberProgressGamification";

describe("memberProgressGamification", () => {
  it("counts consecutive training weeks", () => {
    const keys = ["2026-20", "2026-19", "2026-18", "2026-16"];
    expect(computeStreakWeeks(keys)).toBe(3);
  });

  it("builds three clear goals for the working level", () => {
    const goals = buildProgressGoals(2, { completedSessions: 12, streakWeeks: 4, uniqueTrainingDays: 8 });
    expect(goals).toHaveLength(3);
    expect(goals.map((goal) => goal.title)).toEqual(["Streak", "Fullførte økter", "Ulike treningsdager"]);
  });

  it("uses friendly step labels", () => {
    expect(getProgressStepLabel(1)).toBe("Kom i gang");
    expect(getProgressStepLabel(10)).toBe("Motus-mester");
  });

  it("explains celebration in plain language", () => {
    const copy = buildCelebrationCopy(3);
    expect(copy.title).toContain("Bygger vanen");
    expect(copy.body).toContain("steg 3");
  });

  it("nudges when current week is missing from streak", () => {
    const now = new Date("2026-05-16T12:00:00");
    const lastWeek = new Date("2026-05-02T12:00:00");
    const trainingWeekKeys = [getWeekKey(lastWeek)];
    const subline = buildStreakSubline(2, 4, 2, now, trainingWeekKeys);
    expect(subline.toLowerCase()).toContain("denne uken");
  });

  it("aggregates member progress state", () => {
    const state = computeMemberProgressState({
      completedLogDates: [new Date("2026-05-10"), new Date("2026-05-03"), new Date("2026-04-26")],
      nowDate: new Date("2026-05-16"),
      sessionsPerWeekTarget: 3,
    });
    expect(state.streakWeeks).toBeGreaterThan(0);
    expect(state.goals).toHaveLength(3);
    expect(computeAchievedLevel(3, state.streakWeeks, 3)).toBeGreaterThanOrEqual(0);
  });
});
