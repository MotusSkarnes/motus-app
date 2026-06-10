import { describe, expect, it } from "vitest";
import {
  memberCustomerTierSortRank,
  memberMatchesCustomerTypeFilter,
  resolveMemberCustomerTier,
} from "./memberCustomerTier";
import type { Member } from "./types";

function member(partial: Partial<Member>): Member {
  return {
    id: "m1",
    name: "Test",
    email: "t@example.com",
    phone: "",
    birthDate: "",
    goal: "",
    focus: "",
    injuries: "",
    personalGoals: "",
    membershipType: "Standard",
    customerType: "Medlem",
    nutritionAccess: false,
    daysSinceActivity: "0",
    isActive: true,
    invitedAt: "",
    firstLoginAt: "",
    ...partial,
  };
}

describe("memberCustomerTier", () => {
  it("resolves premium before shared medlem", () => {
    expect(resolveMemberCustomerTier(member({ customerType: "Medlem", membershipType: "Premium" }))).toBe("premium");
    expect(resolveMemberCustomerTier(member({ customerType: "Medlem", membershipType: "Standard" }))).toBe("medlem");
    expect(resolveMemberCustomerTier(member({ customerType: "PT-kunde", membershipType: "Standard" }))).toBe("pt-kunde");
  });

  it("filters PT-kunde without premium overlap", () => {
    const pt = member({ customerType: "PT-kunde", membershipType: "Standard" });
    const premium = member({ customerType: "PT-kunde", membershipType: "Premium" });
    expect(memberMatchesCustomerTypeFilter(pt, "PT-kunde")).toBe(true);
    expect(memberMatchesCustomerTypeFilter(premium, "PT-kunde")).toBe(false);
    expect(memberMatchesCustomerTypeFilter(premium, "Premium-kunde")).toBe(true);
  });

  it("sorts premium first when requested", () => {
    const premium = member({ customerType: "PT-kunde", membershipType: "Premium" });
    const pt = member({ customerType: "PT-kunde", membershipType: "Standard" });
    expect(memberCustomerTierSortRank(premium, "typePremiumFirst")).toBeLessThan(
      memberCustomerTierSortRank(pt, "typePremiumFirst"),
    );
  });
});
