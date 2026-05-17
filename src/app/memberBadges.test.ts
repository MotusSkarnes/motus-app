import { describe, expect, it } from "vitest";
import { computeMaxLiftKgFromLogs, computeMemberBadges, computeMonthUniqueDays } from "./memberBadges";

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

  it("builds categories with several badge levels", () => {
    const collection = computeMemberBadges(baseInput);
    expect(collection.categories.length).toBeGreaterThan(3);
    expect(collection.allBadges.length).toBeGreaterThan(20);
    expect(collection.categories.every((category) => category.badges.length > 1)).toBe(true);
  });

  it("unlocks the first session badge level", () => {
    const collection = computeMemberBadges({
      ...baseInput,
      completedSessionCount: 1,
    });
    const first = collection.allBadges.find((badge) => badge.id === "sessions-bronze");
    expect(first?.unlocked).toBe(true);
    expect(first?.level).toBe("bronze");
    expect(first?.category).toBe("training");
  });

  it("tracks lift progress toward gold strength level", () => {
    const collection = computeMemberBadges(baseInput);
    const liftGold = collection.allBadges.find((badge) => badge.id === "lift-gold");
    expect(liftGold?.unlocked).toBe(false);
    expect(liftGold?.current).toBe(80);
    expect(liftGold?.target).toBe(90);
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

  it("counts unique training days in month", () => {
    const days = computeMonthUniqueDays(
      [new Date("2026-05-03"), new Date("2026-05-03"), new Date("2026-05-10")],
      new Date("2026-05-16"),
    );
    expect(days).toBe(2);
  });
});
