import { describe, expect, it } from "vitest";
import { PROFILE_METRICS_PREFIX, readProfileExtensions } from "./memberProfilePayload";

describe("readProfileExtensions", () => {
  it("preserves period plan completion and swap payloads", () => {
    const personalGoals = `${PROFILE_METRICS_PREFIX}${JSON.stringify({
      sessionsPerWeekTarget: "4",
      periodPlanCompletion: {
        version: 1,
        completedEntryKeys: ["plan-1:1:mon"],
        dismissedEntryKeys: ["plan-1:1:tue"],
        updatedAt: 123,
      },
      periodPlanSwaps: {
        version: 1,
        swapsByPlan: { "plan-1": { "1": { mon: "wed" } } },
        updatedAt: 456,
      },
    })}`;

    const extensions = readProfileExtensions(personalGoals);

    expect(extensions.periodPlanCompletion).toEqual({
      version: 1,
      completedEntryKeys: ["plan-1:1:mon"],
      dismissedEntryKeys: ["plan-1:1:tue"],
      updatedAt: 123,
    });
    expect(extensions.periodPlanSwaps).toEqual({
      version: 1,
      swapsByPlan: { "plan-1": { "1": { mon: "wed" } } },
      updatedAt: 456,
    });
  });
});
