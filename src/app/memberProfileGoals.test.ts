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
});
