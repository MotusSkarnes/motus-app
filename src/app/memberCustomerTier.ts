import { isSharedMedlemRosterMember } from "../services/memberAccessRules";
import type { Member } from "./types";

export type MemberCustomerTypeFilter = "all" | "PT-kunde" | "Premium-kunde" | "Medlem";

export type MemberCustomerTypeSort =
  | "activityRecent"
  | "nameAsc"
  | "nameDesc"
  | "typePremiumFirst"
  | "typePtFirst"
  | "typeMedlemFirst";

export type MemberCustomerTier = "premium" | "pt-kunde" | "medlem" | "other";

export function resolveMemberCustomerTier(member: Pick<Member, "customerType" | "membershipType">): MemberCustomerTier {
  if (member.membershipType === "Premium") return "premium";
  if (isSharedMedlemRosterMember(member)) return "medlem";
  if (member.customerType === "PT-kunde") return "pt-kunde";
  return "other";
}

export function memberMatchesCustomerTypeFilter(
  member: Pick<Member, "customerType" | "membershipType">,
  filter: MemberCustomerTypeFilter,
): boolean {
  if (filter === "all") return true;
  if (filter === "Premium-kunde") return member.membershipType === "Premium";
  if (filter === "Medlem") return isSharedMedlemRosterMember(member);
  if (filter === "PT-kunde") {
    return member.customerType === "PT-kunde" && member.membershipType !== "Premium";
  }
  return true;
}

const TIER_BASE_RANK: Record<MemberCustomerTier, number> = {
  premium: 0,
  "pt-kunde": 1,
  medlem: 2,
  other: 3,
};

export function memberCustomerTierSortRank(
  member: Pick<Member, "customerType" | "membershipType">,
  sort: Extract<MemberCustomerTypeSort, "typePremiumFirst" | "typePtFirst" | "typeMedlemFirst">,
): number {
  const tier = resolveMemberCustomerTier(member);
  if (sort === "typePremiumFirst") return TIER_BASE_RANK[tier];
  if (sort === "typePtFirst") {
    if (tier === "pt-kunde") return 0;
    if (tier === "premium") return 1;
    if (tier === "medlem") return 2;
    return 3;
  }
  if (tier === "medlem") return 0;
  if (tier === "premium") return 1;
  if (tier === "pt-kunde") return 2;
  return 3;
}

export function isMemberCustomerTypeSort(sort: MemberCustomerTypeSort): sort is "typePremiumFirst" | "typePtFirst" | "typeMedlemFirst" {
  return sort === "typePremiumFirst" || sort === "typePtFirst" || sort === "typeMedlemFirst";
}
