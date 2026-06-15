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
      localUpdatedAt: 1000,
    });
    expect(result.completedKeys).toEqual(["plan-1:1:monday"]);
    expect(result.dismissedKeys).toContain("plan-1:1:friday");
  });

  it("keeps stored completed keys even before logs have hydrated", () => {
    const result = reconcilePeriodPlanCompletionKeys({
      storedCompleted: ["plan-1:1:monday", "plan-1:1:tuesday"],
      storedDismissed: [],
      remotePrefs: {
        version: 1,
        completedEntryKeys: ["plan-1:1:wednesday"],
        dismissedEntryKeys: [],
        updatedAt: 500,
      },
      derivedCompleted: ["plan-1:1:monday"],
    });
    expect(result.completedKeys).toEqual(["plan-1:1:monday", "plan-1:1:tuesday", "plan-1:1:wednesday"]);
  });

  it("drops stale completed keys once hydrated logs are authoritative", () => {
    const result = reconcilePeriodPlanCompletionKeys({
      storedCompleted: ["plan-1:1:monday"],
      storedDismissed: [],
      remotePrefs: {
        version: 1,
        completedEntryKeys: ["plan-1:1:monday"],
        dismissedEntryKeys: [],
        updatedAt: 500,
      },
      derivedCompleted: ["plan-1:1:sunday"],
      derivedCompletedIsAuthoritative: true,
    });
    expect(result.completedKeys).toEqual(["plan-1:1:sunday"]);
  });

  it("local dismissed clear with newer timestamp overrides stale remote dismissed", () => {
    const result = reconcilePeriodPlanCompletionKeys({
      storedCompleted: ["plan-1:1:tuesday"],
      storedDismissed: [],
      remotePrefs: {
        version: 1,
        completedEntryKeys: [],
        dismissedEntryKeys: ["plan-1:1:tuesday"],
        updatedAt: 500,
      },
      derivedCompleted: ["plan-1:1:tuesday"],
      localUpdatedAt: 1000,
    });
    expect(result.completedKeys).toEqual(["plan-1:1:tuesday"]);
    expect(result.dismissedKeys).toEqual([]);
  });

  it("falls back to remote dismissed when local has not been touched", () => {
    const result = reconcilePeriodPlanCompletionKeys({
      storedCompleted: [],
      storedDismissed: [],
      remotePrefs: {
        version: 1,
        completedEntryKeys: [],
        dismissedEntryKeys: ["plan-1:1:wednesday"],
        updatedAt: 500,
      },
      derivedCompleted: ["plan-1:1:wednesday"],
    });
    expect(result.completedKeys).toEqual([]);
    expect(result.dismissedKeys).toEqual(["plan-1:1:wednesday"]);
  });

  it("preserves caller-supplied updatedAt when writing to personal_goals", () => {
    // Regression: tidligere ble updatedAt overskrevet med Date.now() ved
    // hver persist-write. Det førte til at sky-ekkoet fikk et nyere
    // timestamp enn det lokale ref-et, og merge anså remote som «nyest»,
    // som igjen overstyrte en nylig fjernet dismissed-rad.
    const encoded = mergePeriodPlanCompletionIntoPersonalGoals("", {
      version: 1,
      completedEntryKeys: ["plan-1:1:monday"],
      dismissedEntryKeys: [],
      updatedAt: 4242,
    });
    const read = readPeriodPlanCompletionFromPersonalGoals(encoded);
    expect(read?.updatedAt).toBe(4242);
  });

  it("falls back to Date.now() when caller omits updatedAt", () => {
    const before = Date.now();
    const encoded = mergePeriodPlanCompletionIntoPersonalGoals("", {
      version: 1,
      completedEntryKeys: [],
      dismissedEntryKeys: [],
      updatedAt: 0,
    });
    const read = readPeriodPlanCompletionFromPersonalGoals(encoded);
    expect(read?.updatedAt ?? 0).toBeGreaterThanOrEqual(before);
  });
});
