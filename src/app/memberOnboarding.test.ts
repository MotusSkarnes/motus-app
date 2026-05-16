import { describe, expect, it } from "vitest";
import {
  createEmptyOnboardingDraft,
  enrichMemberWithBestProfile,
  getOnboardingFromPersonalGoals,
  isOnboardingCompleted,
  mergeOnboardingIntoPersonalGoals,
  primaryGoalFromOnboarding,
  resolveMemberOnboarding,
} from "./memberOnboarding";
import type { Member } from "./types";

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

  it("detects completion from onboardingCompletedAt when row has sparse blob", () => {
    const sparse = `MOTUS_PROFILE_V1:${JSON.stringify({ onboardingCompletedAt: "2026-05-16T12:00:00.000Z" })}`;
    expect(isOnboardingCompleted(sparse)).toBe(true);
    expect(getOnboardingFromPersonalGoals(sparse)?.completedAt).toBe("2026-05-16T12:00:00.000Z");
  });

  it("enriches member with personal_goals from duplicate email rows", () => {
    const rich = `MOTUS_PROFILE_V1:${JSON.stringify({
      onboarding: { version: 1, completedAt: "2026-05-01T00:00:00.000Z", skipped: false, trainingGoals: ["Styrke"] },
      onboardingCompletedAt: "2026-05-01T00:00:00.000Z",
    })}`;
    const base: Member = {
      id: "a",
      name: "Test",
      email: "t@test.no",
      personalGoals: "",
      goal: "",
      focus: "",
      injuries: "",
      level: "Nybegynner",
      membershipType: "Premium",
      customerType: "PT-kunde",
      daysSinceActivity: 0,
      phone: "",
      birthDate: "",
      coachNotes: "",
      avatarUrl: "",
      invitedAt: "",
      isActive: true,
    };
    const other = { ...base, id: "b", personalGoals: rich };
    expect(isOnboardingCompleted(enrichMemberWithBestProfile(base, [base, other]).personalGoals)).toBe(true);
  });

  it("resolveMemberOnboarding finds skjema when another row has only månedlig innsjekk-blob", () => {
    const onboardingBlob = mergeOnboardingIntoPersonalGoals("", {
      ...createEmptyOnboardingDraft(),
      version: 1,
      trainingGoals: ["Utholdenhet"],
      motivations: ["Helse"],
      completedAt: "2026-05-16T12:00:00.000Z",
    });
    const checkInOnly = `MOTUS_PROFILE_V1:${JSON.stringify({
      monthlyCheckIns: [{ id: "c1", completedAt: "2026-05-10T00:00:00.000Z" }],
    })}`;
    const base: Member = {
      id: "trainer-row",
      name: "Test",
      email: "t@test.no",
      personalGoals: checkInOnly,
      goal: "",
      focus: "",
      injuries: "",
      level: "Nybegynner",
      membershipType: "Premium",
      customerType: "PT-kunde",
      daysSinceActivity: 0,
      phone: "",
      birthDate: "",
      coachNotes: "",
      avatarUrl: "",
      invitedAt: "",
      isActive: true,
    };
    const memberRow = { ...base, id: "member-row", personalGoals: onboardingBlob };
    const resolved = resolveMemberOnboarding(base, [base, memberRow]);
    expect(resolved?.trainingGoals).toEqual(["Utholdenhet"]);
  });
});
