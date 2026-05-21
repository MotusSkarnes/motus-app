import { describe, expect, it } from "vitest";
import {
  createEmptyOnboardingDraft,
  enrichMemberWithBestProfile,
  getOnboardingFromPersonalGoals,
  hasSeenMemberWelcome,
  isOnboardingCompleted,
  markMemberWelcomeSeen,
  mergeOnboardingIntoPersonalGoals,
  primaryGoalFromOnboarding,
  findMembersByEmail,
  memberOnboardingIdentityKey,
  resolveMemberOnboarding,
} from "./memberOnboarding";
import type { Member } from "./types";

describe("memberOnboarding", () => {
  it("tracks first-login welcome per member identity", () => {
    const member: Member = {
      id: "welcome-test",
      name: "Test",
      email: "welcome@test.no",
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
    const key = memberOnboardingIdentityKey(member);
    const storageKey = `motus.member.welcome.seen.v1:${key}`;
    window.localStorage.removeItem(storageKey);
    expect(hasSeenMemberWelcome(key)).toBe(false);
    markMemberWelcomeSeen(key);
    expect(hasSeenMemberWelcome(key)).toBe(true);
    window.localStorage.removeItem(storageKey);
  });

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

  it("treats sparse onboardingCompletedAt-only blob as incomplete", () => {
    const sparse = `MOTUS_PROFILE_V1:${JSON.stringify({ onboardingCompletedAt: "2026-05-16T12:00:00.000Z" })}`;
    expect(isOnboardingCompleted(sparse)).toBe(false);
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

  it("enrichMemberWithBestProfile merges phone and birthDate from duplicate email rows", () => {
    const authRow: Member = {
      id: "auth-abc",
      name: "Lene",
      email: "lene@test.no",
      personalGoals: "",
      goal: "",
      focus: "",
      injuries: "",
      level: "Nybegynner",
      membershipType: "Premium",
      customerType: "PT-kunde",
      daysSinceActivity: "0",
      phone: "",
      birthDate: "",
      coachNotes: "",
      avatarUrl: "",
      invitedAt: "",
      isActive: true,
    };
    const dbRow: Member = {
      ...authRow,
      id: "m-lene",
      phone: "99 88 77 66",
      birthDate: "14.06.1991",
    };
    const enriched = enrichMemberWithBestProfile(authRow, [authRow, dbRow]);
    expect(enriched.id).toBe("m-lene");
    expect(enriched.phone).toBe("99 88 77 66");
    expect(enriched.birthDate).toBe("14.06.1991");
  });

  it("enrichMemberWithBestProfile prefers canonical row phone over longer stale duplicate", () => {
    const canonical: Member = {
      id: "m-lene",
      name: "Lene",
      email: "lene@test.no",
      personalGoals: "",
      goal: "",
      focus: "",
      injuries: "",
      level: "Nybegynner",
      membershipType: "Premium",
      customerType: "PT-kunde",
      daysSinceActivity: "0",
      phone: "12345678",
      birthDate: "01.01.2000",
      coachNotes: "",
      avatarUrl: "",
      invitedAt: "",
      isActive: true,
    };
    const stale: Member = {
      ...canonical,
      id: "auth-abc",
      phone: "99 88 77 66 55 44",
      birthDate: "14.06.1991",
    };
    const enriched = enrichMemberWithBestProfile(canonical, [canonical, stale]);
    expect(enriched.id).toBe("m-lene");
    expect(enriched.phone).toBe("12345678");
    expect(enriched.birthDate).toBe("01.01.2000");
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

  it("kobler ikke oppstartsskjema mellom ulike e-poster", () => {
    const onboardingBlob = mergeOnboardingIntoPersonalGoals("", {
      ...createEmptyOnboardingDraft(),
      version: 1,
      trainingGoals: ["Styrke"],
      completedAt: "2026-05-16T12:00:00.000Z",
    });
    const msn: Member = {
      id: "msn-row",
      name: "Lene Ruud",
      email: "leneruud@msn.com",
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
    const gmail = { ...msn, id: "gmail-row", email: "lene.norex@gmail.com", personalGoals: onboardingBlob };
    expect(findMembersByEmail(msn, [msn, gmail]).map((row) => row.id)).toEqual(["msn-row"]);
    expect(resolveMemberOnboarding(msn, [msn, gmail])).toBeNull();
    expect(resolveMemberOnboarding(gmail, [msn, gmail])?.trainingGoals).toEqual(["Styrke"]);
  });
});
