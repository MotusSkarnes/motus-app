import { describe, expect, it } from "vitest";
import {
  buildUnauthedMemberBootstrapIds,
  canIncludeMemberRowByTrustedId,
  canMarkChatMessagesRead,
  readTrustedAuthMemberId,
} from "./memberAccessSecurity";

describe("memberAccessSecurity", () => {
  it("does not trust a client-editable user_metadata member id", () => {
    expect(
      readTrustedAuthMemberId({
        app_metadata: {},
        user_metadata: { member_id: "member-victim" },
      }),
    ).toBe("");
  });

  it("reads only app_metadata.member_id as the trusted member link", () => {
    expect(
      readTrustedAuthMemberId({
        app_metadata: { member_id: "member-123" },
        user_metadata: { member_id: "member-forged" },
      }),
    ).toBe("member-123");
  });

  it("rejects trusted-id roster widening when the member email does not match", () => {
    expect(
      canIncludeMemberRowByTrustedId({
        requesterEmail: "attacker@example.com",
        trustedMemberId: "member-victim",
        memberRow: {
          id: "member-victim",
          email: "victim@example.com",
          owner_user_id: "trainer-1",
          is_active: true,
        },
      }),
    ).toBe(false);
  });

  it("allows trusted-id roster widening only for the authenticated email", () => {
    expect(
      canIncludeMemberRowByTrustedId({
        requesterEmail: "MEMBER@example.com",
        trustedMemberId: "member-123",
        memberRow: {
          id: "member-123",
          email: "member@example.com",
          owner_user_id: "trainer-1",
          is_active: true,
        },
      }),
    ).toBe(true);
  });

  it("never bootstraps hydration with an arbitrary trusted member uuid", () => {
    expect(
      buildUnauthedMemberBootstrapIds({
        requesterUserId: "user-attacker",
        trustedMemberId: "member-victim",
      }),
    ).toEqual(["user-attacker", "auth-user-attacker"]);
  });

  it("allows synthetic trusted bootstrap ids for the authenticated user", () => {
    expect(
      buildUnauthedMemberBootstrapIds({
        requesterUserId: "user-1",
        trustedMemberId: "auth-user-1",
      }),
    ).toEqual(["user-1", "auth-user-1"]);
  });

  it("blocks any authenticated user from marking another member thread as read", () => {
    expect(
      canMarkChatMessagesRead({
        reader: "member",
        requesterUserId: "user-attacker",
        requesterEmail: "attacker@example.com",
        trustedMemberId: "",
        requestedMemberId: "member-victim",
        memberRow: {
          id: "member-victim",
          email: "victim@example.com",
          owner_user_id: "trainer-1",
          customer_type: "PT-kunde",
        },
      }),
    ).toBe(false);
    expect(
      canMarkChatMessagesRead({
        reader: "trainer",
        requesterUserId: "trainer-attacker",
        requesterEmail: "other-pt@motus-skarnes.no",
        trustedMemberId: "",
        requestedMemberId: "member-victim",
        memberRow: {
          id: "member-victim",
          email: "victim@example.com",
          owner_user_id: "trainer-1",
          customer_type: "PT-kunde",
        },
      }),
    ).toBe(false);
  });

  it("allows the owning trainer, shared Medlem trainers, and the member themselves", () => {
    const row = {
      id: "member-123",
      email: "member@example.com",
      owner_user_id: "trainer-1",
      customer_type: "PT-kunde",
    };
    expect(
      canMarkChatMessagesRead({
        reader: "trainer",
        requesterUserId: "trainer-1",
        requesterEmail: "pt@motus-skarnes.no",
        trustedMemberId: "",
        requestedMemberId: "member-123",
        memberRow: row,
      }),
    ).toBe(true);
    expect(
      canMarkChatMessagesRead({
        reader: "trainer",
        requesterUserId: "trainer-2",
        requesterEmail: "pt2@motus-skarnes.no",
        trustedMemberId: "",
        requestedMemberId: "member-123",
        memberRow: { ...row, customer_type: "Medlem", owner_user_id: "trainer-1" },
      }),
    ).toBe(true);
    expect(
      canMarkChatMessagesRead({
        reader: "member",
        requesterUserId: "user-1",
        requesterEmail: "member@example.com",
        trustedMemberId: "",
        requestedMemberId: "member-123",
        memberRow: row,
      }),
    ).toBe(true);
    expect(
      canMarkChatMessagesRead({
        reader: "member",
        requesterUserId: "user-1",
        requesterEmail: "other@example.com",
        trustedMemberId: "member-123",
        requestedMemberId: "member-123",
        memberRow: row,
      }),
    ).toBe(true);
  });
});
