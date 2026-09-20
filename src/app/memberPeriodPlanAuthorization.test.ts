import { describe, expect, it } from "vitest";
import {
  isActiveMemberPeriodPlanRow,
  isMemberPeriodPlanRowAuthorized,
  readTrustedMemberId,
} from "../../supabase/functions/_shared/memberPeriodPlanAuthorization";

describe("member period plan authorization", () => {
  it("does not treat a synthetic auth id as authorization for every member row", () => {
    expect(
      isMemberPeriodPlanRowAuthorized(
        {
          id: "auth-user-id",
          email: "attacker@example.no",
          role: "member",
          memberId: "auth-auth-user-id",
        },
        {
          id: "victim-member-id",
          email: "victim@example.no",
          owner_user_id: "victim-trainer-id",
        },
      ),
    ).toBe(false);
  });

  it("only reads member identity from admin-controlled app metadata", () => {
    expect(
      readTrustedMemberId({
        app_metadata: {},
        user_metadata: { member_id: "victim-member-id" },
      }),
    ).toBe("");
  });

  it("allows members by trusted id or matching authenticated email", () => {
    const row = { id: "member-id", email: "member@example.no", owner_user_id: "trainer-id" };
    expect(
      isMemberPeriodPlanRowAuthorized(
        { id: "auth-id", email: "other@example.no", role: "member", memberId: "member-id" },
        row,
      ),
    ).toBe(true);
    expect(
      isMemberPeriodPlanRowAuthorized(
        { id: "auth-id", email: "MEMBER@example.no", role: "member", memberId: "" },
        row,
      ),
    ).toBe(true);
  });

  it("allows trainers only for rows they own", () => {
    const user = { id: "trainer-id", email: "trainer@example.no", role: "trainer", memberId: "" };
    expect(
      isMemberPeriodPlanRowAuthorized(user, {
        id: "member-id",
        email: "member@example.no",
        owner_user_id: "trainer-id",
      }),
    ).toBe(true);
    expect(
      isMemberPeriodPlanRowAuthorized(user, {
        id: "other-member-id",
        email: "other@example.no",
        owner_user_id: "other-trainer-id",
      }),
    ).toBe(false);
  });

  it("rejects archived rows from period plan writes", () => {
    expect(isActiveMemberPeriodPlanRow({ is_active: false })).toBe(false);
    expect(isActiveMemberPeriodPlanRow({ is_active: true })).toBe(true);
    expect(isActiveMemberPeriodPlanRow({ is_active: null })).toBe(true);
  });
});
