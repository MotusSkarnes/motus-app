import { describe, expect, it } from "vitest";
import {
  buildSeenHiddenBadgeBaselineIds,
  findNextHiddenBadgeCelebration,
} from "./hiddenBadgeCelebrations";

describe("hiddenBadgeCelebrations", () => {
  it("baselines only already-seen unlocked hidden badges", () => {
    const baseline = buildSeenHiddenBadgeBaselineIds(
      ["secret-seen", "secret-unseen"],
      new Set(["secret-seen"]),
    );

    expect(Array.from(baseline)).toEqual(["secret-seen"]);
  });

  it("selects an unlocked hidden badge that was not previously seen", () => {
    const next = findNextHiddenBadgeCelebration(
      [
        { id: "regular", secret: false, unlocked: true },
        { id: "secret-seen", secret: true, unlocked: true },
        { id: "secret-unseen", secret: true, unlocked: true },
      ],
      new Set(["secret-seen"]),
      new Set(["secret-seen"]),
    );

    expect(next?.id).toBe("secret-unseen");
  });
});
