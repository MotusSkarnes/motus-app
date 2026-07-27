export type MemberAccessAuthUser = {
  id?: string;
  email?: string | null;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
};

export type MemberAccessMemberRow = {
  id?: unknown;
  email?: unknown;
  owner_user_id?: unknown;
  customer_type?: unknown;
  is_active?: unknown;
};

function normalizeString(value: unknown): string {
  return String(value ?? "").trim();
}

export function normalizeMemberAccessEmail(value: unknown): string {
  return normalizeString(value).toLowerCase();
}

/** Only trust admin-controlled app_metadata.member_id — never mutable user_metadata. */
export function readTrustedAuthMemberId(user: MemberAccessAuthUser): string {
  return typeof user.app_metadata?.member_id === "string"
    ? normalizeString(user.app_metadata.member_id)
    : "";
}

export function isSharedMedlemRow(row: MemberAccessMemberRow | null | undefined): boolean {
  return normalizeString(row?.customer_type).toLowerCase() === "medlem";
}

/**
 * A JWT-linked member id may only widen roster/hydration scope when the
 * matched members row belongs to the authenticated email.
 */
export function canIncludeMemberRowByTrustedId(input: {
  requesterEmail: string;
  trustedMemberId: string;
  memberRow: MemberAccessMemberRow | null | undefined;
}): boolean {
  const trustedMemberId = normalizeString(input.trustedMemberId);
  const requesterEmail = normalizeMemberAccessEmail(input.requesterEmail);
  const row = input.memberRow;
  if (!trustedMemberId || !requesterEmail.includes("@") || !row) return false;

  const rowId = normalizeString(row.id);
  const rowEmail = normalizeMemberAccessEmail(row.email);
  if (!rowId || rowId !== trustedMemberId) return false;
  return Boolean(rowEmail && rowEmail === requesterEmail);
}

/**
 * Synthetic bootstrap ids for members without a roster row.
 * Never include an arbitrary trusted member UUID here — that would leak
 * another member's programs/logs/messages through service-role lookups.
 */
export function buildUnauthedMemberBootstrapIds(input: {
  requesterUserId: string;
  trustedMemberId?: string;
}): string[] {
  const requesterUserId = normalizeString(input.requesterUserId);
  const trustedMemberId = normalizeString(input.trustedMemberId);
  const ids = new Set<string>();
  if (requesterUserId) {
    ids.add(requesterUserId);
    ids.add(`auth-${requesterUserId}`);
  }
  if (
    trustedMemberId &&
    (trustedMemberId === requesterUserId || trustedMemberId === `auth-${requesterUserId}`)
  ) {
    ids.add(trustedMemberId);
  }
  return Array.from(ids).filter((value) => value && value !== "__template__");
}

/**
 * Mark-read may only update the caller's own thread:
 * - trainer reader: owning trainer or shared Medlem roster
 * - member reader: matching auth email or trusted app_metadata.member_id
 */
export function canMarkChatMessagesRead(input: {
  reader: "trainer" | "member";
  requesterUserId: string;
  requesterEmail: string;
  trustedMemberId: string;
  requestedMemberId: string;
  memberRow: MemberAccessMemberRow | null | undefined;
}): boolean {
  const requestedMemberId = normalizeString(input.requestedMemberId);
  const requesterUserId = normalizeString(input.requesterUserId);
  const requesterEmail = normalizeMemberAccessEmail(input.requesterEmail);
  const trustedMemberId = normalizeString(input.trustedMemberId);
  const row = input.memberRow;
  if (!requestedMemberId || !requesterUserId || !row) return false;

  const rowId = normalizeString(row.id);
  if (!rowId || rowId !== requestedMemberId) return false;

  if (input.reader === "trainer") {
    const owner = normalizeString(row.owner_user_id);
    if (owner && owner === requesterUserId) return true;
    return isSharedMedlemRow(row);
  }

  if (trustedMemberId && trustedMemberId === requestedMemberId) return true;
  const rowEmail = normalizeMemberAccessEmail(row.email);
  return Boolean(requesterEmail && rowEmail && requesterEmail === rowEmail);
}
