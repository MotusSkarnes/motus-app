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

  it("prefers blob with stop goals over notification-only", () => {
    const withStopGoals = `MOTUS_PROFILE_V1:${JSON.stringify({
      stopGoals: [{ target: "Brus", customTarget: "", startedAt: "2026-07-01" }],
    })}`;
    const notificationOnly = `MOTUS_PROFILE_V1:${JSON.stringify({
      notificationPreferences: { seenHiddenBadgeIds: ["badge-1"] },
    })}`;
    expect(pickBestPersonalGoals([notificationOnly, withStopGoals])).toBe(withStopGoals);
  });
});
