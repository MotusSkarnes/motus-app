import { describe, expect, it } from "vitest";
import {
  canInviteTrainerMember,
  canUpsertTrainerOwnedMember,
  isTrainerCaller,
  readTrustedAuthMemberId,
} from "./trainerMemberMutationSecurity";

describe("trainerMemberMutationSecurity", () => {
  it("ignores mutable user_metadata when reading trusted auth member id", () => {
    expect(
      readTrustedAuthMemberId({
        app_metadata: {},
        user_metadata: { member_id: "forged-member" },
      }),
    ).toBe("");
    expect(
      readTrustedAuthMemberId({
        app_metadata: { member_id: "real-member" },
        user_metadata: { member_id: "forged-member" },
      }),
    ).toBe("real-member");
  });

  it("does not let members escalate via ownerUserId self-match or forged user_metadata.role", () => {
    expect(
      isTrainerCaller({
        id: "member-user",
        email: "member@example.com",
        app_metadata: {},
        user_metadata: { role: "trainer" },
      }),
    ).toBe(false);

    // Legacy bypass was: any auth user with ownerUserId === user.id. That must stay closed.
    expect(
      isTrainerCaller({
        id: "member-user",
        email: "member@example.com",
        app_metadata: { role: "member" },
        user_metadata: {},
      }),
    ).toBe(false);
  });

  it("allows trainers via app_metadata.role or staff email without linked customer id", () => {
    expect(
      isTrainerCaller({
        id: "trainer-1",
        email: "pt@example.com",
        app_metadata: { role: "trainer" },
      }),
    ).toBe(true);
    expect(
      isTrainerCaller({
        id: "trainer-2",
        email: "lene@motus-skarnes.no",
        app_metadata: {},
      }),
    ).toBe(true);
    expect(
      isTrainerCaller({
        id: "staff-as-client",
        email: "resepsjon@motus-skarnes.no",
        app_metadata: { member_id: "client-row" },
      }),
    ).toBe(false);
  });

  it("blocks upsert overwrite of another trainer's member id", () => {
    expect(
      canUpsertTrainerOwnedMember({
        requesterUserId: "trainer-attacker",
        existingRow: { id: "victim-member", owner_user_id: "trainer-owner" },
      }),
    ).toBe(false);
    expect(
      canUpsertTrainerOwnedMember({
        requesterUserId: "trainer-owner",
        existingRow: { id: "victim-member", owner_user_id: "trainer-owner" },
      }),
    ).toBe(true);
    expect(
      canUpsertTrainerOwnedMember({
        requesterUserId: "trainer-owner",
        existingRow: null,
      }),
    ).toBe(true);
  });

  it("requires invite email to match the owned member row", () => {
    expect(
      canInviteTrainerMember({
        requesterUserId: "trainer-1",
        inviteEmail: "attacker@example.com",
        memberRow: {
          id: "member-1",
          email: "client@example.com",
          owner_user_id: "trainer-1",
          customer_type: "PT-kunde",
        },
      }),
    ).toBe(false);

    expect(
      canInviteTrainerMember({
        requesterUserId: "trainer-1",
        inviteEmail: "client@example.com",
        memberRow: {
          id: "member-1",
          email: "client@example.com",
          owner_user_id: "trainer-1",
          customer_type: "PT-kunde",
        },
      }),
    ).toBe(true);

    expect(
      canInviteTrainerMember({
        requesterUserId: "trainer-attacker",
        inviteEmail: "client@example.com",
        memberRow: {
          id: "member-1",
          email: "client@example.com",
          owner_user_id: "trainer-owner",
          customer_type: "PT-kunde",
        },
      }),
    ).toBe(false);

    expect(
      canInviteTrainerMember({
        requesterUserId: "trainer-2",
        inviteEmail: "shared@example.com",
        memberRow: {
          id: "member-shared",
          email: "shared@example.com",
          owner_user_id: "trainer-1",
          customer_type: "Medlem",
        },
      }),
    ).toBe(true);
  });
});
