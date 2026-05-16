import { describe, expect, it } from "vitest";
import {
  computeMaxLiftKgFromLogs,
  computeMemberBadges,
  computeMonthUniqueDays,
  pickMonthlyBadgeIds,
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

  it("unlocks first session badge permanently", () => {
    const collection = computeMemberBadges({
      ...baseInput,
      completedSessionCount: 1,
    });
    const first = collection.permanent.find((badge) => badge.id === "first-session");
    expect(first?.unlocked).toBe(true);
    expect(first?.kind).toBe("permanent");
  });

  it("provides three rotating monthly badges", () => {
    const collection = computeMemberBadges(baseInput);
    expect(collection.monthly).toHaveLength(3);
    expect(collection.monthly.every((badge) => badge.kind === "monthly")).toBe(true);
    expect(collection.monthLabel.toLowerCase()).toContain("2026");
  });

  it("rotates monthly badge set by calendar month", () => {
    const may = pickMonthlyBadgeIds(2026, 4);
    const june = pickMonthlyBadgeIds(2026, 5);
    expect(may).toHaveLength(3);
    expect(june).toHaveLength(3);
    expect(may.join(",")).not.toBe(june.join(","));
  });

  it("tracks lift progress toward 100 kg", () => {
    const collection = computeMemberBadges(baseInput);
    const lift100 = collection.permanent.find((badge) => badge.id === "lift-100");
    expect(lift100?.unlocked).toBe(false);
    expect(lift100?.current).toBe(80);
    expect(lift100?.target).toBe(100);
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
