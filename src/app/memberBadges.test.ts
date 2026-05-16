import { describe, expect, it } from "vitest";
import { computeMaxLiftKgFromLogs, computeMemberBadges } from "./memberBadges";

describe("memberBadges", () => {
  it("unlocks first session badge", () => {
    const badges = computeMemberBadges({
      completedSessionCount: 1,
      streakWeeks: 0,
      maxLiftKg: 0,
      monthGoalCurrent: 0,
      monthGoalTarget: 12,
    });
    const first = badges.find((badge) => badge.id === "first-session");
    expect(first?.unlocked).toBe(true);
  });

  it("tracks lift progress toward 100 kg", () => {
    const badges = computeMemberBadges({
      completedSessionCount: 5,
      streakWeeks: 2,
      maxLiftKg: 80,
      monthGoalCurrent: 3,
      monthGoalTarget: 12,
    });
    const lift100 = badges.find((badge) => badge.id === "lift-100");
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
});
