import { describe, expect, it } from "vitest";
import { canDeleteMemberPeriodPlan } from "./memberPeriodPlanDeleteSecurity";

const memberPlan = {
  member_id: "member-1",
  owner_user_id: "trainer-1",
  plan: { id: "plan-1", periodPlanAddedBy: "member" },
};

describe("member period plan delete security", () => {
  it("allows a member to delete their own member-created plan", () => {
    expect(
      canDeleteMemberPeriodPlan({
        row: memberPlan,
        member: { id: "member-1", email: "member@example.com", is_active: true },
        user: { id: "auth-member", email: "MEMBER@example.com" },
      }),
    ).toBe(true);
  });

  it("rejects deletion of trainer-created plans by members", () => {
    expect(
      canDeleteMemberPeriodPlan({
        row: { ...memberPlan, plan: { id: "plan-1", periodPlanAddedBy: "trainer" } },
        member: { id: "member-1", email: "member@example.com", is_active: true },
        user: { id: "auth-member", email: "member@example.com" },
      }),
    ).toBe(false);
  });

  it("rejects client-editable metadata and unrelated member rows", () => {
    expect(
      canDeleteMemberPeriodPlan({
        row: memberPlan,
        member: { id: "member-1", email: "victim@example.com", is_active: true },
        user: {
          id: "auth-attacker",
          email: "attacker@example.com",
          app_metadata: {},
        },
      }),
    ).toBe(false);
  });

  it("rejects archived member writes", () => {
    expect(
      canDeleteMemberPeriodPlan({
        row: memberPlan,
        member: { id: "member-1", email: "member@example.com", is_active: false },
        user: { id: "auth-member", email: "member@example.com" },
      }),
    ).toBe(false);
  });

  it("allows the owning trainer to delete any plan type", () => {
    expect(
      canDeleteMemberPeriodPlan({
        row: { ...memberPlan, plan: { id: "plan-1", periodPlanAddedBy: "trainer" } },
        user: { id: "trainer-1", email: "trainer@example.com" },
      }),
    ).toBe(true);
  });
});
