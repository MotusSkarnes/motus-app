import { describe, expect, it } from "vitest";
import {
  createEmptyOnboardingDraft,
  enrichMemberWithBestProfile,
  getOnboardingFromPersonalGoals,
  hasSeenMemberWelcome,
  isMemberOnboardingComplete,
  isMemberOnboardingSubmitted,
  isOnboardingCompleted,
  markMemberWelcomeSeen,
  mergeOnboardingIntoPersonalGoals,
  mergePersonalGoalsFromCandidates,
  pickBestMemberDisplayName,
  onboardingAnswersAreSubstantive,
  primaryGoalFromOnboarding,
  findMembersByEmail,
  memberOnboardingIdentityKey,
  markOnboardingCompleteLocally,
  hasLocalOnboardingComplete,
  resolveMemberOnboarding,
} from "./memberOnboarding";
import { patchMemberAppUiStateInPersonalGoals } from "./memberAppUiState";
import { getStopGoalsFromPersonalGoals } from "./memberStopGoal";
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

  it("treats any submitted onboarding as submitted for member prompts", () => {
    const sparse = `MOTUS_PROFILE_V1:${JSON.stringify({ onboardingCompletedAt: "2026-05-16T12:00:00.000Z" })}`;
    const member: Member = {
      id: "submitted",
      name: "Test",
      email: "submitted@test.no",
      isActive: true,
      invitedAt: "",
      phone: "",
      birthDate: "",
      weight: "",
      height: "",
      level: "Nybegynner",
      membershipType: "Premium",
      customerType: "PT-kunde",
      daysSinceActivity: "",
      goal: "",
      focus: "",
      personalGoals: sparse,
      injuries: "",
      coachNotes: "",
    };
    expect(isMemberOnboardingComplete(member, [member])).toBe(false);
    expect(isMemberOnboardingSubmitted(member, [member])).toBe(true);
  });

  it("treats malformed personal_goals with onboarding marker as submitted (defensiv fallback)", () => {
    // Personal_goals som ikke parses som ren MOTUS_PROFILE_V1-JSON,
    // men inneholder onboarding-markørene. Brukes som siste forsvarslinje
    // mot at kunden ser prompten p\u00e5 hjem etter \u00e5 ha fylt ut skjemaet.
    const malformed = `Some notes here\n{"trainingGoals":["Styrke"]\n"onboardingCompletedAt":"2026-05-16T12:00:00.000Z"`;
    const member: Member = {
      id: "submitted-2",
      name: "Test",
      email: "submitted2@test.no",
      isActive: true,
      invitedAt: "",
      phone: "",
      birthDate: "",
      weight: "",
      height: "",
      level: "Nybegynner",
      membershipType: "Premium",
      customerType: "PT-kunde",
      daysSinceActivity: "",
      goal: "",
      focus: "",
      personalGoals: malformed,
      injuries: "",
      coachNotes: "",
    };
    expect(isMemberOnboardingSubmitted(member, [member])).toBe(true);
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
    expect(onboardingAnswersAreSubstantive(resolved)).toBe(true);
  });

  it("mergePersonalGoalsFromCandidates keeps onboarding when best blob is notification-only", () => {
    const onboardingBlob = mergeOnboardingIntoPersonalGoals("", {
      ...createEmptyOnboardingDraft(),
      version: 1,
      trainingGoals: ["Styrke"],
      motivations: ["Helse"],
      completedAt: "2026-05-16T12:00:00.000Z",
    });
    const notificationOnly = `MOTUS_PROFILE_V1:${JSON.stringify({
      notificationPreferences: { seenHiddenBadgeIds: ["badge-1"], openedMemberAlertIds: ["alert-1"] },
    })}`;
    const merged = mergePersonalGoalsFromCandidates([notificationOnly, onboardingBlob]);
    expect(isOnboardingCompleted(merged)).toBe(true);
    expect(getOnboardingFromPersonalGoals(merged)?.trainingGoals).toEqual(["Styrke"]);
  });

  it("mergePersonalGoalsFromCandidates preserves stop goals from duplicate rows", () => {
    const onboardingBlob = mergeOnboardingIntoPersonalGoals("", {
      ...createEmptyOnboardingDraft(),
      version: 1,
      trainingGoals: ["Styrke"],
      motivations: ["Helse"],
      completedAt: "2026-05-16T12:00:00.000Z",
    });
    const stopGoalBlob = `MOTUS_PROFILE_V1:${JSON.stringify({
      stopGoals: [
        { target: "Brus", customTarget: "", startedAt: "2026-07-01" },
        { target: "Røyk", customTarget: "", startedAt: "2026-07-02" },
      ],
    })}`;

    const merged = mergePersonalGoalsFromCandidates([onboardingBlob, stopGoalBlob]);

    expect(isOnboardingCompleted(merged)).toBe(true);
    expect(getStopGoalsFromPersonalGoals(merged)).toEqual([
      { target: "Brus", customTarget: "", startedAt: "2026-07-01" },
      { target: "Røyk", customTarget: "", startedAt: "2026-07-02" },
    ]);
  });

  it("mergeOnboardingIntoPersonalGoals preserves existing stop goals", () => {
    const existing = `MOTUS_PROFILE_V1:${JSON.stringify({
      stopGoal: { target: "Brus", customTarget: "", startedAt: "2026-07-01" },
      stopGoals: [{ target: "Brus", customTarget: "", startedAt: "2026-07-01" }],
    })}`;

    const merged = mergeOnboardingIntoPersonalGoals(existing, {
      ...createEmptyOnboardingDraft(),
      version: 1,
      trainingGoals: ["Styrke"],
      motivations: ["Helse"],
      completedAt: "2026-05-16T12:00:00.000Z",
    });

    expect(isOnboardingCompleted(merged)).toBe(true);
    expect(getStopGoalsFromPersonalGoals(merged)).toEqual([
      { target: "Brus", customTarget: "", startedAt: "2026-07-01" },
    ]);
  });

  it("isMemberOnboardingComplete respects local completion marker", () => {
    const member: Member = {
      id: "local-onboarding",
      name: "Test",
      email: "local@test.no",
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
    window.localStorage.removeItem(`motus.member.onboarding.complete.v1:${key}`);
    expect(isMemberOnboardingComplete(member, [member])).toBe(false);
    markOnboardingCompleteLocally(key, "2026-05-16T12:00:00.000Z");
    expect(isMemberOnboardingComplete(member, [member])).toBe(true);
    window.localStorage.removeItem(`motus.member.onboarding.complete.v1:${key}`);
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

  it("prefers profileDisplayName over stale duplicate row names", () => {
    const personalGoals = patchMemberAppUiStateInPersonalGoals("", {
      profileDisplayName: "Karen H. Østergard",
    });
    const authRow: Member = {
      id: "auth-karen",
      name: "Karen Hancke",
      email: "karen@example.com",
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
    const realRow: Member = {
      ...authRow,
      id: "member-karen",
      name: "Karen Hancke",
      personalGoals,
    };
    expect(pickBestMemberDisplayName(authRow, [authRow, realRow], personalGoals)).toBe("Karen H. Østergard");
    expect(enrichMemberWithBestProfile(authRow, [authRow, realRow]).name).toBe("Karen H. Østergard");
  });
});
