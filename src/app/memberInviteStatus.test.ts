import { describe, expect, it } from "vitest";
import { mergeOnboardingIntoPersonalGoals, createEmptyOnboardingDraft } from "./memberOnboarding";
import {
  applyFirstLoginStampToMembersByEmail,
  memberEffectivelyInvited,
  memberHasFirstLoginStamp,
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
    firstLoginAt: "",
    isActive: true,
    ...overrides,
  };
}

describe("memberInviteStatus", () => {
  it("treats invited_at as invited", () => {
    const member = baseMember({ invitedAt: "2026-05-01T12:00:00.000Z" });
    expect(memberEffectivelyInvited(member, [member])).toBe(true);
  });

  it("treats first_login_at as activated", () => {
    const member = baseMember({ firstLoginAt: "2026-05-02T08:00:00.000Z" });
    expect(memberHasFirstLoginStamp(member)).toBe(true);
    expect(memberEffectivelyInvited(member, [member])).toBe(true);
  });

  it("treats logged-in auth row as invited even without stamps", () => {
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

  it("applyFirstLoginStampToMembersByEmail stamps all duplicate rows for email", () => {
    const stamp = "2026-05-20T10:00:00.000Z";
    const state: AppState = {
      members: [
        baseMember({ id: "m-1", firstLoginAt: "" }),
        baseMember({ id: "auth-1", firstLoginAt: "" }),
      ],
    } as AppState;
    const next = applyFirstLoginStampToMembersByEmail(state, "kari@test.no", stamp);
    expect(next.members.every((member) => member.firstLoginAt === stamp)).toBe(true);
  });

  it("still flags customers with no invite stamp and no app activity", () => {
    const member = baseMember({ invitedAt: "", firstLoginAt: "" });
    expect(memberEffectivelyInvited(member, [member])).toBe(false);
    expect(rosterMembersMissingInvite([member], [member])).toHaveLength(1);
  });
});
