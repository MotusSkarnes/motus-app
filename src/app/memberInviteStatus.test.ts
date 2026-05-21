import { describe, expect, it } from "vitest";
import { mergeOnboardingIntoPersonalGoals, createEmptyOnboardingDraft } from "./memberOnboarding";
import {
  applyInviteStampToMembersByEmail,
  memberEffectivelyInvited,
  rosterMembersMissingInvite,
} from "./memberInviteStatus";
import type { AppState } from "./types";
import type { Member } from "./types";

function baseMember(overrides: Partial<Member> = {}): Member {
  return {
    id: "m-1",
    name: "Kari",
    email: "kari@test.no",
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
    ...overrides,
  };
}

describe("memberInviteStatus", () => {
  it("treats invited_at as invited", () => {
    const member = baseMember({ invitedAt: "2026-05-01T12:00:00.000Z" });
    expect(memberEffectivelyInvited(member, [member])).toBe(true);
  });

  it("treats logged-in auth row as invited even without invited_at", () => {
    const dbRow = baseMember({ id: "m-kari", invitedAt: "" });
    const authRow = baseMember({ id: "auth-abc", invitedAt: "" });
    expect(memberEffectivelyInvited(dbRow, [dbRow, authRow])).toBe(true);
    expect(rosterMembersMissingInvite([dbRow], [dbRow, authRow])).toHaveLength(0);
  });

  it("treats completed onboarding as invited", () => {
    const goals = mergeOnboardingIntoPersonalGoals("", {
      ...createEmptyOnboardingDraft(),
      trainingGoals: ["Styrke"],
      completedAt: "2026-05-01T12:00:00.000Z",
      skipped: false,
    });
    const member = baseMember({ personalGoals: goals });
    expect(memberEffectivelyInvited(member, [member])).toBe(true);
  });

  it("treats member messages as invited", () => {
    const member = baseMember({ invitedAt: "" });
    expect(
      memberEffectivelyInvited(member, [member], {
        messages: [
          {
            id: "msg-1",
            memberId: "m-1",
            sender: "member",
            text: "Hei",
            createdAt: "2026-05-16",
          },
        ],
      }),
    ).toBe(true);
  });

  it("applyInviteStampToMembersByEmail stamps all duplicate rows for email", () => {
    const stamp = "2026-05-20T10:00:00.000Z";
    const state: AppState = {
      members: [
        baseMember({ id: "m-1", invitedAt: "" }),
        baseMember({ id: "auth-1", invitedAt: "" }),
      ],
    } as AppState;
    const next = applyInviteStampToMembersByEmail(state, "kari@test.no", stamp);
    expect(next.members.every((member) => member.invitedAt === stamp)).toBe(true);
  });

  it("still flags customers with no invite stamp and no app activity", () => {
    const member = baseMember({ invitedAt: "" });
    expect(memberEffectivelyInvited(member, [member])).toBe(false);
    expect(rosterMembersMissingInvite([member], [member])).toHaveLength(1);
  });
});
