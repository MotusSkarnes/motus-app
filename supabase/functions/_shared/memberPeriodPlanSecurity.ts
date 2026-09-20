export type MemberPeriodPlanIdentity = {
  id?: string;
  email?: string | null;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
};

type MemberRowIdentity = {
  id?: unknown;
  email?: unknown;
};

function normalizeString(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeEmail(value: unknown): string {
  return normalizeString(value).toLowerCase();
}

/**
 * app_metadata is server-controlled. user_metadata is intentionally ignored
 * because authenticated users can edit it themselves.
 */
export function readTrustedAuthMemberId(user: MemberPeriodPlanIdentity): string {
  return typeof user.app_metadata?.member_id === "string" ? normalizeString(user.app_metadata.member_id) : "";
}

export function isSameMember(
  user: Pick<MemberPeriodPlanIdentity, "email">,
  row: MemberRowIdentity,
  trustedMemberId: string,
): boolean {
  const rowId = normalizeString(row.id);
  if (trustedMemberId && trustedMemberId === rowId) return true;

  const userEmail = normalizeEmail(user.email);
  const rowEmail = normalizeEmail(row.email);
  return Boolean(userEmail && rowEmail && userEmail === rowEmail);
}
