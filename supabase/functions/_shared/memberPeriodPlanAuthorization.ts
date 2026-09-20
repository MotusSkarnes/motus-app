type AuthenticatedPeriodPlanUser = {
  id?: unknown;
  email?: unknown;
  role?: unknown;
  memberId?: unknown;
};

type MemberPeriodPlanRow = {
  id?: unknown;
  email?: unknown;
  owner_user_id?: unknown;
  is_active?: unknown;
};

function normalizeString(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeEmail(value: unknown): string {
  return normalizeString(value).toLowerCase();
}

export function readTrustedMemberId(user: {
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
}): string {
  return typeof user.app_metadata?.member_id === "string" ? normalizeString(user.app_metadata.member_id) : "";
}

export function isMemberPeriodPlanRowAuthorized(
  user: AuthenticatedPeriodPlanUser,
  row: MemberPeriodPlanRow,
): boolean {
  const requesterId = normalizeString(user.id);
  const ownerUserId = normalizeString(row.owner_user_id);
  if (normalizeString(user.role).toLowerCase() === "trainer" && ownerUserId === requesterId) return true;

  const rowId = normalizeString(row.id);
  const trustedMemberId = normalizeString(user.memberId);
  if (trustedMemberId && trustedMemberId === rowId) return true;

  const requesterEmail = normalizeEmail(user.email);
  const rowEmail = normalizeEmail(row.email);
  return Boolean(requesterEmail && rowEmail && requesterEmail === rowEmail);
}

export function isActiveMemberPeriodPlanRow(row: MemberPeriodPlanRow): boolean {
  return row.is_active !== false;
}
