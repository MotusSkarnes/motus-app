import { describe, expect, it } from "vitest";
import {
  computeConsistencyScore,
  computeMemberProgressScores,
  computeMemberXpState,
  computeMomentumScore,
  computeRecoveryScore,
  computeWeeklyScore,
} from "./memberMomentumScores";

describe("memberMomentumScores", () => {
  it("detects upward momentum vs last week", () => {
    const now = new Date("2026-05-16T12:00:00");
    const dates = [
      new Date("2026-05-14"),
      new Date("2026-05-12"),
      new Date("2026-05-05"),
    ];
    const score = computeMomentumScore({
      completedLogDates: dates,
      nowDate: now,
      sessionsPerWeekTarget: 2,
    });
    expect(score.trend).toBe("up");
    expect(score.subline).toContain("forrige uke");
  });

  it("computes weekly score against target", () => {
    const now = new Date("2026-05-16T12:00:00");
    const dates = [new Date("2026-05-14"), new Date("2026-05-12")];
    const weekly = computeWeeklyScore(dates, now, 3);
    expect(weekly.score).toBe(2);
    expect(weekly.maxScore).toBe(3);
    expect(weekly.subline).toContain("1 økt");
  });

  it("uses the PT plan as the weekly target when available", () => {
    const now = new Date("2026-05-16T12:00:00");
    const dates = [new Date("2026-05-14")];
    const weekly = computeWeeklyScore(dates, now, 5, 2);
    expect(weekly.maxScore).toBe(2);
    expect(weekly.source).toBe("program");
    expect(weekly.subline).toContain("PT-planen");
  });

  it("uses completed period plan sessions for the weekly score numerator", () => {
    const now = new Date("2026-05-16T12:00:00");
    const weekly = computeWeeklyScore([new Date("2026-05-14")], now, 3, 5, 2);
    expect(weekly.score).toBe(2);
    expect(weekly.maxScore).toBe(5);
    expect(weekly.subline).toContain("3");
    expect(weekly.subline).toContain("PT-planen");
  });

  it("does not invent a default weekly target when no plan or profile goal exists", () => {
    const now = new Date("2026-05-16T12:00:00");
    const weekly = computeWeeklyScore([], now);
    expect(weekly.maxScore).toBeNull();
    expect(weekly.source).toBe("missing");
    expect(weekly.subline).toContain("Sett ukemål");
  });

  it("derives consistency from streak and recent weeks", () => {
    const score = computeConsistencyScore(4, [
      { trained: true },
      { trained: true },
      { trained: false },
      { trained: true },
      { trained: true },
      { trained: true },
      { trained: true },
      { trained: false },
    ]);
    expect(score.pct).toBeGreaterThan(50);
  });

  it("computes recovery from reflections", () => {
    const score = computeRecoveryScore([
      { energyLevel: 2, difficultyLevel: 3, motivationLevel: 3, note: "" },
      { energyLevel: 2, difficultyLevel: 2, motivationLevel: 4, note: "" },
    ]);
    expect(score.pct).not.toBeNull();
    expect(score.pct).toBeGreaterThan(50);
  });

  it("levels XP from sessions and streak", () => {
    const xp = computeMemberXpState(12, 3, 2);
    expect(xp.totalXp).toBeGreaterThan(300);
    expect(xp.level).toBeGreaterThanOrEqual(1);
    expect(xp.pctToNext).toBeGreaterThan(0);
  });

  it("aggregates all progress scores", () => {
    const scores = computeMemberProgressScores({
      completedLogDates: [new Date("2026-05-14"), new Date("2026-05-05")],
      completedSessions: 2,
      nowDate: new Date("2026-05-16"),
      streakWeeks: 2,
      achievedLevel: 1,
      recentStreakWeeks: [{ trained: true }, { trained: true }],
      sessionsPerWeekTarget: 3,
    });
    expect(scores.momentum.pct).toBeGreaterThanOrEqual(0);
    expect(scores.xp.totalXp).toBeGreaterThan(0);
  });
});
