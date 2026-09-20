export type MemberPeriodPlanMemberRow = {
  id?: unknown;
  email?: unknown;
  owner_user_id?: unknown;
  customer_type?: unknown;
  membership_type?: unknown;
  nutrition_access?: unknown;
  personal_goals?: unknown;
  is_active?: unknown;
};

type AuthUserIdentity = {
  id?: string;
  email?: string | null;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
};

function normalizeString(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeEmail(value: unknown): string {
  return normalizeString(value).toLowerCase();
}

export function readTrustedAuthMemberId(user: AuthUserIdentity): string {
  return typeof user.app_metadata?.member_id === "string" ? normalizeString(user.app_metadata.member_id) : "";
}

export function isSameMember(
  user: Pick<AuthUserIdentity, "id" | "email">,
  row: MemberPeriodPlanMemberRow,
  trustedMemberId: string,
): boolean {
  const rowId = normalizeString(row.id);
  if (trustedMemberId && trustedMemberId === rowId) return true;
  const userEmail = normalizeEmail(user.email);
  const rowEmail = normalizeEmail(row.email);
  return Boolean(userEmail && rowEmail && userEmail === rowEmail);
}

function scoreCanonicalMemberRow(row: MemberPeriodPlanMemberRow): number {
  let score = 0;
  const id = normalizeString(row.id);
  if (id.startsWith("member-")) score += 20_000;
  else if (!/^m\d+$/i.test(id)) score += 10_000;
  if (row.is_active !== false) score += 5_000;
  if (row.nutrition_access === true) score += 2_000;
  if (normalizeString(row.customer_type) === "PT-kunde") score += 1_000;
  if (normalizeString(row.membership_type) === "Premium") score += 500;
  if (normalizeString(row.personal_goals).includes("onboardingCompletedAt")) score += 80;
  return score;
}

export function pickCanonicalMemberRow(rows: MemberPeriodPlanMemberRow[]): MemberPeriodPlanMemberRow | undefined {
  return [...rows].sort((a, b) => scoreCanonicalMemberRow(b) - scoreCanonicalMemberRow(a))[0];
}

export function isMemberOwnedPlanPayload(plan: unknown): boolean {
  if (!plan || typeof plan !== "object") return false;
  return normalizeString((plan as Record<string, unknown>).periodPlanAddedBy) === "member";
}
