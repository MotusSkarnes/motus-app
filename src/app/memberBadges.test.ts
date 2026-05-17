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

  it("keeps 17. mai badge hidden until a workout is completed on May 17", () => {
    const withoutMay17 = computeMemberBadges({
      ...baseInput,
      completedLogDates: [new Date("2026-05-16T12:00:00")],
    });
    expect(withoutMay17.allBadges.some((badge) => badge.id === "may-17-workout")).toBe(false);

    const withMay17 = computeMemberBadges({
      ...baseInput,
      completedLogDates: [new Date("2026-05-17T12:00:00")],
    });
    const badge = withMay17.allBadges.find((item) => item.id === "may-17-workout");
    expect(badge?.unlocked).toBe(true);
    expect(badge?.secret).toBe(true);
    expect(withMay17.categories.some((category) => category.id === "secret")).toBe(true);
  });

  it("unlocks hidden no-two-weeks-without badge after six months without a 14 day break", () => {
    const nowDate = new Date("2026-05-16T12:00:00");
    const steadyDates: Date[] = [];
    for (let date = new Date("2025-11-16T12:00:00"); date <= nowDate; date.setDate(date.getDate() + 14)) {
      steadyDates.push(new Date(date));
    }

    const steady = computeMemberBadges({
      ...baseInput,
      nowDate,
      completedLogDates: steadyDates,
    });
    expect(steady.allBadges.find((badge) => badge.id === "never-two-weeks-without")?.unlocked).toBe(true);

    const withGap = computeMemberBadges({
      ...baseInput,
      nowDate,
      completedLogDates: [new Date("2025-11-16T12:00:00"), new Date("2025-12-02T12:00:00")],
    });
    expect(withGap.allBadges.some((badge) => badge.id === "never-two-weeks-without")).toBe(false);
  });

  it("unlocks hidden comeback badge after a long training pause", () => {
    const comeback = computeMemberBadges({
      ...baseInput,
      completedLogDates: [new Date("2026-01-01T12:00:00"), new Date("2026-02-01T12:00:00")],
    });
    expect(comeback.allBadges.find((badge) => badge.id === "back-again")?.unlocked).toBe(true);

    const shortPause = computeMemberBadges({
      ...baseInput,
      completedLogDates: [new Date("2026-01-01T12:00:00"), new Date("2026-01-29T12:00:00")],
    });
    expect(shortPause.allBadges.some((badge) => badge.id === "back-again")).toBe(false);
  });

  it("unlocks hidden habit badge 100 days after first workout", () => {
    const after100Days = computeMemberBadges({
      ...baseInput,
      nowDate: new Date("2026-05-16T12:00:00"),
      completedLogDates: [new Date("2026-02-05T12:00:00")],
    });
    expect(after100Days.allBadges.find((badge) => badge.id === "habit-sticks")?.unlocked).toBe(true);

    const before100Days = computeMemberBadges({
      ...baseInput,
      nowDate: new Date("2026-05-16T12:00:00"),
      completedLogDates: [new Date("2026-02-06T12:00:00")],
    });
    expect(before100Days.allBadges.some((badge) => badge.id === "habit-sticks")).toBe(false);
  });

  it("unlocks hidden before-sunrise badge for workouts before 05:30", () => {
    const early = computeMemberBadges({
      ...baseInput,
      completedLogDates: [new Date("2026-05-16T05:29:00")],
    });
    expect(early.allBadges.find((badge) => badge.id === "before-sunrise")?.unlocked).toBe(true);

    const tooLate = computeMemberBadges({
      ...baseInput,
      completedLogDates: [new Date("2026-05-16T05:30:00")],
    });
    expect(tooLate.allBadges.some((badge) => badge.id === "before-sunrise")).toBe(false);
  });

  it("unlocks hidden summer-loyal badge for workouts in July", () => {
    const inJuly = computeMemberBadges({
      ...baseInput,
      completedLogDates: [new Date("2026-07-12T12:00:00")],
    });
    expect(inJuly.allBadges.find((badge) => badge.id === "summer-loyal")?.unlocked).toBe(true);

    const outsideJuly = computeMemberBadges({
      ...baseInput,
      completedLogDates: [new Date("2026-08-01T12:00:00")],
    });
    expect(outsideJuly.allBadges.some((badge) => badge.id === "summer-loyal")).toBe(false);
  });

  it("unlocks hidden new-start badge for workouts in January", () => {
    const inJanuary = computeMemberBadges({
      ...baseInput,
      completedLogDates: [new Date("2026-01-03T12:00:00")],
    });
    expect(inJanuary.allBadges.find((badge) => badge.id === "new-start")?.unlocked).toBe(true);

    const outsideJanuary = computeMemberBadges({
      ...baseInput,
      completedLogDates: [new Date("2026-02-01T12:00:00")],
    });
    expect(outsideJanuary.allBadges.some((badge) => badge.id === "new-start")).toBe(false);
  });

  it("counts unique training days in month", () => {
    const days = computeMonthUniqueDays(
      [new Date("2026-05-03"), new Date("2026-05-03"), new Date("2026-05-10")],
      new Date("2026-05-16"),
    );
    expect(days).toBe(2);
  });
});
