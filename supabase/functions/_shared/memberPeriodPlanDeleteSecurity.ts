export type MemberPeriodPlanDeleteRow = {
  member_id?: unknown;
  owner_user_id?: unknown;
  plan?: unknown;
};

export type MemberPeriodPlanDeleteMemberRow = {
  id?: unknown;
  email?: unknown;
  is_active?: unknown;
};

export type MemberPeriodPlanDeleteUser = {
  id?: string;
  email?: string | null;
  app_metadata?: Record<string, unknown>;
};

function normalizeString(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeEmail(value: unknown): string {
  return normalizeString(value).toLowerCase();
}

export function canDeleteMemberPeriodPlan(input: {
  row: MemberPeriodPlanDeleteRow;
  member?: MemberPeriodPlanDeleteMemberRow;
  user: MemberPeriodPlanDeleteUser;
}): boolean {
  const requesterId = normalizeString(input.user.id);
  if (requesterId && normalizeString(input.row.owner_user_id) === requesterId) return true;

  const memberId = normalizeString(input.row.member_id);
  if (!memberId || normalizeString(input.member?.id) !== memberId || input.member?.is_active === false) return false;

  const plan = input.row.plan && typeof input.row.plan === "object"
    ? input.row.plan as Record<string, unknown>
    : {};
  if (normalizeString(plan.periodPlanAddedBy) !== "member") return false;

  const trustedMemberId =
    typeof input.user.app_metadata?.member_id === "string"
      ? normalizeString(input.user.app_metadata.member_id)
      : "";
  if (trustedMemberId && trustedMemberId === memberId) return true;

  const requesterEmail = normalizeEmail(input.user.email);
  return Boolean(requesterEmail && requesterEmail === normalizeEmail(input.member?.email));
}
