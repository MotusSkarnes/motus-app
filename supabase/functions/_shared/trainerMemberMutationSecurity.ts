export type TrainerMutationAuthUser = {
  id?: string;
  email?: string | null;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
};

export type TrainerMutationMemberRow = {
  id?: unknown;
  email?: unknown;
  owner_user_id?: unknown;
  customer_type?: unknown;
  is_active?: unknown;
};

const TRAINER_EMAIL_DOMAIN = "@motus-skarnes.no";

function normalizeString(value: unknown): string {
  return String(value ?? "").trim();
}

export function normalizeTrainerMutationEmail(value: unknown): string {
  return normalizeString(value).toLowerCase();
}

/** Only trust admin-controlled app_metadata.member_id — never mutable user_metadata. */
export function readTrustedAuthMemberId(user: TrainerMutationAuthUser): string {
  return typeof user.app_metadata?.member_id === "string"
    ? normalizeString(user.app_metadata.member_id)
    : "";
}

/**
 * Authorize trainer-only roster mutations from JWT identity.
 * Never trust client ownerUserId self-match, and never trust mutable user_metadata.role.
 */
export function isTrainerCaller(user: TrainerMutationAuthUser): boolean {
  const appRole = normalizeString(user.app_metadata?.role).toLowerCase();
  if (appRole === "member") return false;
  if (appRole === "trainer") return true;

  const email = normalizeTrainerMutationEmail(user.email);
  if (email.endsWith(TRAINER_EMAIL_DOMAIN) && !readTrustedAuthMemberId(user)) return true;
  return false;
}

export function isSharedMedlemRow(row: TrainerMutationMemberRow | null | undefined): boolean {
  return normalizeString(row?.customer_type).toLowerCase() === "medlem";
}

/**
 * Existing member rows may only be upserted by their owning trainer.
 * Missing rows are allowed (new create). Client-supplied IDs must never overwrite another trainer's customer.
 */
export function canUpsertTrainerOwnedMember(input: {
  requesterUserId: string;
  existingRow: TrainerMutationMemberRow | null | undefined;
}): boolean {
  const requesterUserId = normalizeString(input.requesterUserId);
  if (!requesterUserId) return false;
  if (!input.existingRow) return true;
  const existingId = normalizeString(input.existingRow.id);
  if (!existingId) return true;
  const owner = normalizeString(input.existingRow.owner_user_id);
  if (!owner) return true;
  return owner === requesterUserId;
}

/**
 * Invite may proceed only for rows the trainer owns (or shared Medlem / ownerless repair targets).
 * Invite email must match the stored member email so callers cannot relink another customer's id.
 */
export function canInviteTrainerMember(input: {
  requesterUserId: string;
  inviteEmail: string;
  memberRow: TrainerMutationMemberRow | null | undefined;
}): boolean {
  const requesterUserId = normalizeString(input.requesterUserId);
  const inviteEmail = normalizeTrainerMutationEmail(input.inviteEmail);
  const row = input.memberRow;
  if (!requesterUserId || !inviteEmail.includes("@") || !row) return false;

  const rowId = normalizeString(row.id);
  const rowEmail = normalizeTrainerMutationEmail(row.email);
  if (!rowId || !rowEmail || rowEmail !== inviteEmail) return false;

  const owner = normalizeString(row.owner_user_id);
  if (!owner || owner === requesterUserId) return true;
  return isSharedMedlemRow(row);
}
