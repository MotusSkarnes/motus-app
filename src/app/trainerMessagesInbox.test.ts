import { describe, expect, it } from "vitest";
import {
  buildTrainerMessageInboxRows,
  filterMessagesForRosterMember,
  memberHasTrainerMessagingAccess,
} from "./trainerMessagesInbox";
import type { ChatMessage, Member } from "./types";

function member(partial: Partial<Member> & Pick<Member, "id" | "name" | "email">): Member {
  return {
    isActive: true,
    invitedAt: "",
    firstLoginAt: "",
    phone: "",
    birthDate: "",
    weight: "",
    height: "",
    level: "Nybegynner",
    membershipType: "Premium",
    customerType: "PT-kunde",
    daysSinceActivity: "0",
    goal: "",
    focus: "",
    personalGoals: "",
    injuries: "",
    coachNotes: "",
    ...partial,
  };
}

function msg(partial: Partial<ChatMessage> & Pick<ChatMessage, "id" | "memberId" | "sender" | "text">): ChatMessage {
  return {
    createdAt: "2026-09-07T12:00:00.000Z",
    ...partial,
  };
}

describe("trainerMessagesInbox", () => {
  const members = [
    member({ id: "m1", name: "Ada", email: "ada@example.com" }),
    member({ id: "m2", name: "Bo", email: "bo@example.com", membershipType: "Standard", customerType: "Medlem" }),
  ];

  it("filters messages for a roster member", () => {
    const messages = [
      msg({ id: "1", memberId: "m1", sender: "member", text: "Hei" }),
      msg({ id: "2", memberId: "m2", sender: "member", text: "Hallo" }),
      msg({ id: "3", memberId: "m1", sender: "trainer", text: "Svar", createdAt: "2026-09-07T12:01:00.000Z" }),
    ];
    expect(filterMessagesForRosterMember(messages, members, "m1").map((row) => row.id)).toEqual(["1", "3"]);
  });

  it("sorts unread members first in inbox", () => {
    const messages = [
      msg({ id: "1", memberId: "m1", sender: "member", text: "Gammel", createdAt: "2026-09-07T10:00:00.000Z" }),
      msg({ id: "2", memberId: "m2", sender: "member", text: "Ny ulest", createdAt: "2026-09-07T11:00:00.000Z" }),
    ];
    const rows = buildTrainerMessageInboxRows(members, messages, { m2: 2 });
    expect(rows[0]?.member.id).toBe("m2");
    expect(rows[0]?.unreadCount).toBe(2);
    expect(rows[1]?.member.id).toBe("m1");
  });

  it("detects messaging access", () => {
    expect(memberHasTrainerMessagingAccess(members[0]!)).toBe(true);
    expect(memberHasTrainerMessagingAccess(members[1]!)).toBe(false);
  });

  it("dedupes duplicate roster rows for the same email", () => {
    const duplicates = [
      member({ id: "m-a", name: "Lene Ruud", email: "lene@example.com", customerType: "Medlem", membershipType: "Standard" }),
      member({ id: "m-b", name: "Lene Ruud", email: "lene@example.com", customerType: "PT-kunde", membershipType: "Premium" }),
      member({ id: "m-c", name: "Lene Ruud", email: "lene@example.com" }),
      member({ id: "m-other", name: "Lene Ruud", email: "other@example.com" }),
    ];
    const rows = buildTrainerMessageInboxRows(duplicates, [], {});
    const leneRows = rows.filter((row) => row.member.email.toLowerCase() === "lene@example.com");
    expect(leneRows).toHaveLength(1);
    expect(leneRows[0]?.member.id).toBe("m-b");
    expect(rows.filter((row) => row.member.name === "Lene Ruud")).toHaveLength(2);
  });
});
