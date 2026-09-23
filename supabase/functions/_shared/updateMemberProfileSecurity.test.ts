import { describe, expect, it } from "vitest";
import {
  canMemberUseProfileAnchor,
  canTrainerEditProfileAnchor,
  readTrustedAuthMemberId,
  resolveMemberProfileBootstrapId,
  resolveTrainerRosterUpdateIds,
  resolveUpdateMemberProfileRole,
} from "./updateMemberProfileSecurity";

describe("updateMemberProfileSecurity", () => {
  it("ignores mutable user_metadata.member_id", () => {
    expect(
      readTrustedAuthMemberId({
        app_metadata: {},
        user_metadata: { member_id: "forged-victim" },
      }),
    ).toBe("");
    expect(
      readTrustedAuthMemberId({
        app_metadata: { member_id: "real-member" },
        user_metadata: { member_id: "forged-victim" },
      }),
    ).toBe("real-member");
  });

  it("does not let callers become trainers via user_metadata.role", () => {
    expect(
      resolveUpdateMemberProfileRole({
        id: "attacker",
        email: "attacker@example.com",
        app_metadata: {},
        user_metadata: { role: "trainer" },
      }),
    ).toBe("member");

    expect(
      resolveUpdateMemberProfileRole({
        id: "pt",
        email: "pt@example.com",
        app_metadata: { role: "trainer" },
      }),
    ).toBe("trainer");

    expect(
      resolveUpdateMemberProfileRole({
        id: "staff",
        email: "lene@motus-skarnes.no",
        app_metadata: {},
      }),
    ).toBe("trainer");

    expect(
      resolveUpdateMemberProfileRole({
        id: "staff-client",
        email: "resepsjon@motus-skarnes.no",
        app_metadata: { member_id: "client-row" },
      }),
    ).toBe("member");
  });

  it("blocks forged JWT member_id anchors unless email also matches", () => {
    expect(
      canMemberUseProfileAnchor({
        requesterUserId: "attacker-auth",
        requesterEmail: "attacker@example.com",
        trustedMemberId: "victim-member",
        memberRow: {
          id: "victim-member",
          email: "victim@example.com",
          owner_user_id: "pt-1",
        },
      }),
    ).toBe(false);

    expect(
      canMemberUseProfileAnchor({
        requesterUserId: "member-auth",
        requesterEmail: "member@example.com",
        trustedMemberId: "member-row",
        memberRow: {
          id: "member-row",
          email: "member@example.com",
          owner_user_id: "pt-1",
        },
      }),
    ).toBe(true);

    expect(
      canMemberUseProfileAnchor({
        requesterUserId: "member-auth",
        requesterEmail: "member@example.com",
        trustedMemberId: "",
        memberRow: {
          id: "other-row",
          email: "member@example.com",
          owner_user_id: "pt-1",
        },
      }),
    ).toBe(true);
  });

  it("keeps trainer anchors owned/shared/ownerless only", () => {
    expect(
      canTrainerEditProfileAnchor({
        trainerUserId: "pt-attacker",
        memberRow: { id: "a", owner_user_id: "pt-owner", customer_type: "PT-kunde" },
      }),
    ).toBe(false);
    expect(
      canTrainerEditProfileAnchor({
        trainerUserId: "pt-owner",
        memberRow: { id: "a", owner_user_id: "pt-owner", customer_type: "PT-kunde" },
      }),
    ).toBe(true);
    expect(
      canTrainerEditProfileAnchor({
        trainerUserId: "pt-any",
        memberRow: { id: "m", owner_user_id: "pt-other", customer_type: "Medlem" },
      }),
    ).toBe(true);
  });

  it("never falls back to unfiltered client roster ids", () => {
    expect(
      resolveTrainerRosterUpdateIds({
        requestedMemberIds: ["victim-owned-by-other-pt"],
        editableMemberIds: ["owned-by-caller"],
      }),
    ).toEqual([]);
    expect(
      resolveTrainerRosterUpdateIds({
        requestedMemberIds: ["owned-by-caller", "victim-owned-by-other-pt"],
        editableMemberIds: ["owned-by-caller"],
      }),
    ).toEqual(["owned-by-caller"]);
    expect(
      resolveTrainerRosterUpdateIds({
        requestedMemberIds: [],
        editableMemberIds: ["owned-by-caller", "shared-medlem"],
      }),
    ).toEqual(["owned-by-caller", "shared-medlem"]);
  });

  it("does not bootstrap onto client-supplied foreign member ids", () => {
    expect(
      resolveMemberProfileBootstrapId({
        trustedMemberId: "trusted-row",
        requesterUserId: "auth-user",
      }),
    ).toBe("trusted-row");
    expect(
      resolveMemberProfileBootstrapId({
        trustedMemberId: "",
        requesterUserId: "abcdef12-3456-7890",
      }),
    ).toBe("member-abcdef12");
  });
});
