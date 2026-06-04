import { describe, expect, it } from "vitest";
import type { Member } from "./types";
import { buildUnreadMessagesByIdentityKey, memberIdentityKey, unreadCountForMember } from "./trainerUnreadMessages";

const member: Member = {
  id: "member-uuid",
  name: "Kari",
  email: "kari@example.com",
  isActive: true,
  invitedAt: "",
  firstLoginAt: "",
  phone: "",
  birthDate: "",
  gender: "",
  level: "Nybegynner",
  goal: "",
  focus: "",
  injuries: "",
  personalGoals: "",
  membershipType: "Premium",
  customerType: "PT-kunde",
};

describe("trainerUnreadMessages", () => {
  it("maps unread counts by email when alert uses roster id", () => {
    const map = buildUnreadMessagesByIdentityKey([member], { "member-uuid": 2 });
    expect(map.get(memberIdentityKey(member))).toBe(2);
    expect(unreadCountForMember(member, map)).toBe(2);
  });

  it("maps unread counts when alert memberId is email", () => {
    const map = buildUnreadMessagesByIdentityKey([member], { "kari@example.com": 1 });
    expect(unreadCountForMember(member, map)).toBe(1);
  });
});
