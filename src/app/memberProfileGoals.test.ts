import { describe, expect, it } from "vitest";
import { readProfileExtensions } from "./memberOnboarding";
import { pickBestPersonalGoals } from "./memberProfileGoals";

describe("pickBestPersonalGoals", () => {
  it("prefers blob with onboardingCompletedAt over empty", () => {
    const rich = `MOTUS_PROFILE_V1:${JSON.stringify({
      onboardingCompletedAt: "2026-05-01T00:00:00.000Z",
      onboarding: { version: 1, completedAt: "2026-05-01T00:00:00.000Z", trainingGoals: ["Styrke"] },
    })}`;
    expect(pickBestPersonalGoals(["", rich])).toBe(rich);
    expect(readProfileExtensions(pickBestPersonalGoals(["", rich])).onboardingCompletedAt).toBeTruthy();
  });

  it("prefers onboarding blob over månedlig innsjekk-only blob", () => {
    const onboarding = `MOTUS_PROFILE_V1:${JSON.stringify({
      onboardingCompletedAt: "2026-05-01T00:00:00.000Z",
      onboarding: {
        version: 1,
        completedAt: "2026-05-01T00:00:00.000Z",
        trainingGoals: ["Styrke"],
      },
    })}`;
    const checkInOnly = `MOTUS_PROFILE_V1:${JSON.stringify({
      monthlyCheckIns: [{ id: "c1", completedAt: "2026-05-10T00:00:00.000Z" }],
    })}`;
    expect(pickBestPersonalGoals([checkInOnly, onboarding])).toBe(onboarding);
  });

  it("prefers blob with foodAvoidances over notification-only", () => {
    const withAvoidances = `MOTUS_PROFILE_V1:${JSON.stringify({
      foodAvoidances: {
        items: [{ label: "Gluten", key: "gluten" }],
        notes: "",
        updatedAt: 200,
      },
    })}`;
    const notificationOnly = `MOTUS_PROFILE_V1:${JSON.stringify({
      notificationPreferences: { seenHiddenBadgeIds: ["badge-1"] },
    })}`;
    expect(pickBestPersonalGoals([notificationOnly, withAvoidances])).toBe(withAvoidances);
  });

  it("preserves period-plan extension fields for profile rewrites", () => {
    const goals = `MOTUS_PROFILE_V1:${JSON.stringify({
      sessionsPerWeekTarget: "3",
      periodPlanCompletion: {
        version: 1,
        completedEntryKeys: ["plan-1:week-1:monday"],
        dismissedEntryKeys: ["plan-1:week-1:tuesday"],
        updatedAt: 123,
      },
      periodPlanSwaps: {
        version: 1,
        swapsByPlan: { "plan-1": { "1": [{ from: "monday", to: "wednesday" }] } },
        updatedAt: 456,
      },
      memberAppUi: {
        welcomeSeenAt: "2026-07-10T10:00:00.000Z",
      },
    })}`;
    const extensions = readProfileExtensions(goals);
    expect(extensions.periodPlanCompletion).toEqual({
      version: 1,
      completedEntryKeys: ["plan-1:week-1:monday"],
      dismissedEntryKeys: ["plan-1:week-1:tuesday"],
      updatedAt: 123,
    });
    expect(extensions.periodPlanSwaps).toEqual({
      version: 1,
      swapsByPlan: { "plan-1": { "1": [{ from: "monday", to: "wednesday" }] } },
      updatedAt: 456,
    });
    expect(extensions.memberAppUi).toEqual({
      welcomeSeenAt: "2026-07-10T10:00:00.000Z",
    });
  });

  it("prefers comparable rich blob with updated stop-goal state", () => {
    const olderRich = `MOTUS_PROFILE_V1:${JSON.stringify({
      onboardingCompletedAt: "2026-05-01T00:00:00.000Z",
      onboarding: { version: 1, completedAt: "2026-05-01T00:00:00.000Z", trainingGoals: ["Styrke"] },
      periodPlanSwaps: { version: 1, swapsByPlan: {}, updatedAt: 100 },
    })}`;
    const withBreak = `MOTUS_PROFILE_V1:${JSON.stringify({
      onboardingCompletedAt: "2026-05-01T00:00:00.000Z",
      onboarding: { version: 1, completedAt: "2026-05-01T00:00:00.000Z", trainingGoals: ["Styrke"] },
      periodPlanSwaps: { version: 1, swapsByPlan: {}, updatedAt: 100 },
      stopGoals: [{ target: "Snus", customTarget: "", startedAt: "2026-07-09", breakCount: 2 }],
    })}`;
    expect(pickBestPersonalGoals([olderRich, withBreak])).toBe(withBreak);
  });

  it("does not let a stop-only blob replace completed onboarding", () => {
    const onboarding = `MOTUS_PROFILE_V1:${JSON.stringify({
      onboardingCompletedAt: "2026-05-01T00:00:00.000Z",
      onboarding: { version: 1, completedAt: "2026-05-01T00:00:00.000Z", trainingGoals: ["Styrke"] },
    })}`;
    const stopOnly = `MOTUS_PROFILE_V1:${JSON.stringify({
      stopGoals: [{ target: "Snus", customTarget: "", startedAt: "2026-07-09", breakCount: 2 }],
    })}`;
    expect(pickBestPersonalGoals([stopOnly, onboarding])).toBe(onboarding);
  });
});
