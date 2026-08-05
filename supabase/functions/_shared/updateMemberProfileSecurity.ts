export type ProfileAuthUser = {
  id?: string;
  email?: string | null;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
};

export type ProfileMemberRow = {
  id?: unknown;
  email?: unknown;
  owner_user_id?: unknown;
  customer_type?: unknown;
};

const TRAINER_EMAIL_DOMAIN = "@motus-skarnes.no";

function normalizeString(value: unknown): string {
  return String(value ?? "").trim();
}

export function normalizeProfileEmail(value: unknown): string {
  return normalizeString(value).toLowerCase();
}

/** Only trust admin-controlled app_metadata.member_id — never mutable user_metadata. */
export function readTrustedAuthMemberId(user: ProfileAuthUser): string {
  return typeof user.app_metadata?.member_id === "string"
    ? normalizeString(user.app_metadata.member_id)
    : "";
}

export function isSharedMedlemRow(row: ProfileMemberRow | null | undefined): boolean {
  return normalizeString(row?.customer_type).toLowerCase() === "medlem";
}

/**
 * Trainer privileges for profile/roster mutations must never come from mutable
 * user_metadata.role. Staff-domain accounts linked as customers stay members.
 */
export function resolveUpdateMemberProfileRole(user: ProfileAuthUser): "member" | "trainer" {
  const appRole = normalizeString(user.app_metadata?.role).toLowerCase();
  if (appRole === "member") return "member";
  if (appRole === "trainer") return "trainer";

  const trustedMemberId = readTrustedAuthMemberId(user);
  const email = normalizeProfileEmail(user.email);
  if (email.endsWith(TRAINER_EMAIL_DOMAIN) && trustedMemberId) return "member";
  if (email.endsWith(TRAINER_EMAIL_DOMAIN)) return "trainer";
  return "member";
}

/**
 * Member sessions may only target rows that match their authenticated email,
 * or a trusted app_metadata.member_id whose stored email also matches.
 */
export function canMemberUseProfileAnchor(input: {
  requesterUserId: string;
  requesterEmail: string;
  trustedMemberId: string;
  memberRow: ProfileMemberRow | null | undefined;
}): boolean {
  const row = input.memberRow;
  if (!row) return false;
  const rowId = normalizeString(row.id);
  const rowEmail = normalizeProfileEmail(row.email);
  const requesterEmail = normalizeProfileEmail(input.requesterEmail);
  const requesterUserId = normalizeString(input.requesterUserId);
  const trustedMemberId = normalizeString(input.trustedMemberId);

  if (!rowId) return false;
  if (requesterEmail.includes("@") && rowEmail && rowEmail === requesterEmail) return true;
  if (trustedMemberId && trustedMemberId === rowId && rowEmail && rowEmail === requesterEmail) return true;
  // Legacy synthetic rows sometimes used auth.uid() as members.id.
  if (requesterUserId && rowId === requesterUserId && rowEmail && rowEmail === requesterEmail) return true;
  return false;
}

export function canTrainerEditProfileAnchor(input: {
  trainerUserId: string;
  memberRow: ProfileMemberRow | null | undefined;
}): boolean {
  const row = input.memberRow;
  if (!row) return false;
  if (isSharedMedlemRow(row)) return true;
  const ownerUserId = normalizeString(row.owner_user_id);
  if (!ownerUserId) return true;
  return ownerUserId === normalizeString(input.trainerUserId);
}

/**
 * Never fall back to unfiltered client memberIds — that rewrote owner_user_id
 * onto another trainer's customers when none of the requested ids were editable.
 */
export function resolveTrainerRosterUpdateIds(input: {
  requestedMemberIds: string[];
  editableMemberIds: Iterable<string>;
}): string[] {
  const editable = new Set(
    [...input.editableMemberIds].map((value) => normalizeString(value)).filter(Boolean),
  );
  const requested = input.requestedMemberIds.map((value) => normalizeString(value)).filter(Boolean);
  if (requested.length) {
    return Array.from(new Set(requested.filter((id) => editable.has(id))));
  }
  return Array.from(editable);
}

/**
 * Bootstrap must not upsert onto an arbitrary client-supplied member id.
 * Prefer a verified trusted id, otherwise mint a fresh row id.
 */
export function resolveMemberProfileBootstrapId(input: {
  trustedMemberId: string;
  requesterUserId: string;
}): string {
  const trustedMemberId = normalizeString(input.trustedMemberId);
  if (trustedMemberId) return trustedMemberId;
  const requesterUserId = normalizeString(input.requesterUserId);
  if (requesterUserId) return `member-${requesterUserId.slice(0, 8)}`;
  return `member-${crypto.randomUUID().slice(0, 8)}`;
}
