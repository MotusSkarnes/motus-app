import { describe, expect, it } from "vitest";
import {
  isMemberOwnedPlanPayload,
  isSameMember,
  pickCanonicalMemberRow,
  readTrustedAuthMemberId,
} from "./memberPeriodPlanSecurity";

describe("member period plan edge security", () => {
  it("does not trust a client-editable user_metadata member id", () => {
    expect(
      readTrustedAuthMemberId({
        app_metadata: {},
        user_metadata: { member_id: "member-victim" },
      }),
    ).toBe("");
  });

  it("does not treat a synthetic auth id as authorization for an arbitrary member", () => {
    expect(
      isSameMember(
        { id: "user-attacker", email: "attacker@example.com" },
        { id: "member-victim", email: "victim@example.com" },
        "auth-user-attacker",
      ),
    ).toBe(false);
  });

  it("allows a trusted exact member id or matching authenticated email", () => {
    const row = { id: "member-123", email: "member@example.com" };
    expect(isSameMember({ id: "user-1", email: "other@example.com" }, row, "member-123")).toBe(true);
    expect(isSameMember({ id: "user-1", email: "MEMBER@example.com" }, row, "")).toBe(true);
  });

  it("uses the same canonical member preference as the client", () => {
    const canonical = pickCanonicalMemberRow([
      { id: "m1", owner_user_id: "trainer-1", is_active: true },
      { id: "member-abc", owner_user_id: "trainer-1", is_active: true },
    ]);
    expect(canonical?.id).toBe("member-abc");
  });

  it("distinguishes member-created plans from trainer plans", () => {
    expect(isMemberOwnedPlanPayload({ periodPlanAddedBy: "member" })).toBe(true);
    expect(isMemberOwnedPlanPayload({ periodPlanAddedBy: "trainer" })).toBe(false);
    expect(isMemberOwnedPlanPayload({})).toBe(false);
  });
});
