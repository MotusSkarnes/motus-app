import { describe, expect, it } from "vitest";
import {
  computeMaxLiftKgFromLogs,
  computeMemberBadges,
  computeMonthUniqueDays,
  formatBadgeMetricValue,
  getBadgeProgressLabel,
  getBadgeUnlockHint,
} from "./memberBadges";

describe("memberBadges", () => {
  const baseInput = {
    completedSessionCount: 5,
    streakWeeks: 2,
    maxLiftKg: 80,
    monthSessions: 3,
    monthUniqueDays: 3,
    monthWeeksWithSession: 2,
    monthGoalTarget: 12,
    nowDate: new Date("2026-05-16T12:00:00"),
  };

  it("builds categories with one badge per achievement track", () => {
    const collection = computeMemberBadges(baseInput);
    expect(collection.categories.length).toBeGreaterThan(3);
    expect(collection.allBadges.length).toBe(6);
    expect(collection.allBadges.every((badge) => badge.levels.length === 5)).toBe(true);
    expect(collection.allBadges.every((badge) => !badge.id.includes("-bronze"))).toBe(true);
  });

  it("unlocks and upgrades the same session badge", () => {
    const collection = computeMemberBadges({
      ...baseInput,
      completedSessionCount: 1,
    });
    const sessions = collection.allBadges.find((badge) => badge.id === "sessions");
    expect(sessions?.unlocked).toBe(true);
    expect(sessions?.level).toBe("bronze");
    expect(sessions?.category).toBe("training");
    expect(sessions?.target).toBe(10);
    expect(sessions?.levels.filter((level) => level.unlocked)).toHaveLength(1);
  });

  it("tracks lift progress toward the next strength level", () => {
    const collection = computeMemberBadges(baseInput);
    const lift = collection.allBadges.find((badge) => badge.id === "lift");
    expect(lift?.unlocked).toBe(true);
    expect(lift?.level).toBe("silver");
    expect(lift?.current).toBe(80);
    expect(lift?.target).toBe(90);
    expect(lift?.levels.filter((level) => level.unlocked)).toHaveLength(2);
  });

  it("reads max lift from completed sets", () => {
    const max = computeMaxLiftKgFromLogs([
      {
        status: "Fullført",
        results: [
          { completed: true, performedWeight: 60 },
          { completed: true, performedWeight: 105 },
        ],
      },
      { status: "Planlagt", results: [{ completed: true, performedWeight: 200 }] },
    ]);
    expect(max).toBe(105);
  });

  it("formats unlock hints with concrete targets", () => {
    const collection = computeMemberBadges(baseInput);
    const sessions = collection.allBadges.find((badge) => badge.id === "sessions");
    expect(sessions).toBeDefined();
    expect(getBadgeUnlockHint(sessions!)).toContain("10 økter");
    expect(getBadgeProgressLabel(sessions!)).toBe("5 økter av 10 økter");
    expect(formatBadgeMetricValue("streak", 2)).toBe("2 uker");
  });

  it("counts unique training days in month", () => {
    const days = computeMonthUniqueDays(
      [new Date("2026-05-03"), new Date("2026-05-03"), new Date("2026-05-10")],
      new Date("2026-05-16"),
    );
    expect(days).toBe(2);
  });
});
