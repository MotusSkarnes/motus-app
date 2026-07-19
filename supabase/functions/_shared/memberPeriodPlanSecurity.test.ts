import { describe, expect, it } from "vitest";
import { isSameMember, readTrustedAuthMemberId } from "./memberPeriodPlanSecurity";

describe("member period plan edge authorization", () => {
  it("ignores a member id from client-editable user metadata", () => {
    expect(
      readTrustedAuthMemberId({
        app_metadata: {},
        user_metadata: { member_id: "member-victim" },
      }),
    ).toBe("");
  });

  it("does not let a synthetic auth id authorize an unrelated member", () => {
    expect(
      isSameMember(
        { email: "attacker@example.com" },
        { id: "member-victim", email: "victim@example.com" },
        "auth-user-attacker",
      ),
    ).toBe(false);
  });

  it("allows an exact trusted member id", () => {
    expect(
      isSameMember(
        { email: "different@example.com" },
        { id: "member-123", email: "member@example.com" },
        "member-123",
      ),
    ).toBe(true);
  });

  it("allows the authenticated member's normalized email fallback", () => {
    expect(
      isSameMember(
        { email: "MEMBER@example.com" },
        { id: "member-123", email: "member@example.com" },
        "",
      ),
    ).toBe(true);
  });
});
