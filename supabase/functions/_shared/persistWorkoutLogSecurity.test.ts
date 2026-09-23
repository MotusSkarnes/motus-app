import { describe, expect, it } from "vitest";
import {
  canPersistWorkoutLogForMember,
  readTrustedAuthMemberId,
  resolvePersistWorkoutLogRole,
  resolveWorkoutLogOwnerUserId,
} from "./persistWorkoutLogSecurity";

describe("persist-workout-log edge security", () => {
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

  it("does not treat a synthetic auth id as authorization for an arbitrary member", () => {
    expect(
      canPersistWorkoutLogForMember({
        requesterId: "user-attacker",
        requesterEmail: "attacker@example.com",
        requesterRole: "member",
        trustedMemberId: "auth-user-attacker",
        requestedMemberId: "member-victim",
        memberRow: {
          id: "member-victim",
          email: "victim@example.com",
          owner_user_id: "trainer-1",
          is_active: true,
        },
      }),
    ).toBe(false);
  });

  it("allows a trusted exact member id or matching authenticated email", () => {
    const row = {
      id: "member-123",
      email: "member@example.com",
      owner_user_id: "trainer-1",
      is_active: true,
    };
    expect(
      canPersistWorkoutLogForMember({
        requesterId: "user-1",
        requesterEmail: "other@example.com",
        requesterRole: "member",
        trustedMemberId: "member-123",
        requestedMemberId: "member-123",
        memberRow: row,
      }),
    ).toBe(true);
    expect(
      canPersistWorkoutLogForMember({
        requesterId: "user-1",
        requesterEmail: "MEMBER@example.com",
        requesterRole: "member",
        trustedMemberId: "",
        requestedMemberId: "member-123",
        memberRow: row,
      }),
    ).toBe(true);
  });

  it("allows the owning trainer and rejects inactive members", () => {
    expect(
      canPersistWorkoutLogForMember({
        requesterId: "trainer-1",
        requesterEmail: "pt@example.com",
        requesterRole: "trainer",
        trustedMemberId: "",
        requestedMemberId: "member-123",
        memberRow: {
          id: "member-123",
          email: "member@example.com",
          owner_user_id: "trainer-1",
          is_active: true,
        },
      }),
    ).toBe(true);
    expect(
      canPersistWorkoutLogForMember({
        requesterId: "user-1",
        requesterEmail: "member@example.com",
        requesterRole: "member",
        trustedMemberId: "member-123",
        requestedMemberId: "member-123",
        memberRow: {
          id: "member-123",
          email: "member@example.com",
          owner_user_id: "trainer-1",
          is_active: false,
        },
      }),
    ).toBe(false);
  });

  it("resolves app_metadata.role without throwing", () => {
    expect(resolvePersistWorkoutLogRole({ app_metadata: { role: "member" }, user_metadata: {} })).toBe("member");
    expect(resolvePersistWorkoutLogRole({ app_metadata: { role: "trainer" }, user_metadata: {} })).toBe("trainer");
  });

  it("does not let a client owner hint overwrite an existing trainer owner", () => {
    expect(
      resolveWorkoutLogOwnerUserId({
        memberOwner: "trainer-real",
        ownerUserIdHint: "trainer-forged",
        requesterId: "user-1",
        requesterRole: "member",
      }),
    ).toBe("trainer-real");
    expect(
      resolveWorkoutLogOwnerUserId({
        memberOwner: "",
        ownerUserIdHint: "trainer-hint",
        requesterId: "user-1",
        requesterRole: "member",
      }),
    ).toBe("trainer-hint");
  });
});
