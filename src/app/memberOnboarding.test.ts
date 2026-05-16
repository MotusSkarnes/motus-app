import { describe, expect, it } from "vitest";
import {
  createEmptyOnboardingDraft,
  getOnboardingFromPersonalGoals,
  isOnboardingCompleted,
  mergeOnboardingIntoPersonalGoals,
  primaryGoalFromOnboarding,
} from "./memberOnboarding";

describe("memberOnboarding", () => {
  it("roundtrips onboarding in personal_goals", () => {
    const answers = {
      ...createEmptyOnboardingDraft(),
      version: 1 as const,
      trainingGoals: ["Bli sterkere"],
      importanceNow: 8,
      completedAt: "2026-05-16T12:00:00.000Z",
    };
    const encoded = mergeOnboardingIntoPersonalGoals("", answers);
    expect(isOnboardingCompleted(encoded)).toBe(true);
    expect(getOnboardingFromPersonalGoals(encoded)?.trainingGoals).toEqual(["Bli sterkere"]);
    expect(primaryGoalFromOnboarding(answers)).toBe("Bli sterkere");
  });
});
