import { describe, expect, it } from "vitest";
import {
  mergePeriodPlanCompletionIntoPersonalGoals,
  mergePeriodPlanCompletionPrefs,
  readPeriodPlanCompletionFromPersonalGoals,
  reconcilePeriodPlanCompletionKeys,
} from "./periodPlanCompletionPrefs";

describe("periodPlanCompletionPrefs", () => {
  it("round-trips completion prefs in personal_goals", () => {
    const encoded = mergePeriodPlanCompletionIntoPersonalGoals("", {
      version: 1,
      completedEntryKeys: ["plan-1:1:monday"],
      dismissedEntryKeys: [],
      updatedAt: 1000,
    });
    const read = readPeriodPlanCompletionFromPersonalGoals(encoded);
    expect(read?.completedEntryKeys).toEqual(["plan-1:1:monday"]);
  });

  it("unions completed keys from local and remote", () => {
    const merged = mergePeriodPlanCompletionPrefs(
      {
        version: 1,
        completedEntryKeys: ["plan-1:1:monday"],
        dismissedEntryKeys: [],
        updatedAt: 100,
      },
      {
        version: 1,
        completedEntryKeys: ["plan-1:1:tuesday"],
        dismissedEntryKeys: ["plan-1:1:wednesday"],
        updatedAt: 200,
      },
    );
    expect(merged.completedEntryKeys).toEqual(["plan-1:1:monday", "plan-1:1:tuesday"]);
    expect(merged.dismissedEntryKeys).toContain("plan-1:1:wednesday");
  });

  it("reconcile prefers derived log keys and respects dismissed", () => {
    const result = reconcilePeriodPlanCompletionKeys({
      storedCompleted: [],
      storedDismissed: ["plan-1:1:friday"],
      remotePrefs: {
        version: 1,
        completedEntryKeys: ["plan-1:1:monday"],
        dismissedEntryKeys: [],
        updatedAt: 500,
      },
      derivedCompleted: ["plan-1:1:monday", "plan-1:1:friday"],
    });
    expect(result.completedKeys).toEqual(["plan-1:1:monday"]);
    expect(result.dismissedKeys).toContain("plan-1:1:friday");
  });
});
