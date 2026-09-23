export type DeleteProgramAuthUser = {
  id?: string;
  email?: string | null;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
};

export type DeleteProgramMemberRow = {
  id?: unknown;
  email?: unknown;
  owner_user_id?: unknown;
  customer_type?: unknown;
};

const TRAINER_EMAIL_DOMAIN = "@motus-skarnes.no";

function normalizeString(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeEmail(value: unknown): string {
  return normalizeString(value).toLowerCase();
}

/** Only trust admin-controlled app_metadata.member_id — never mutable user_metadata. */
export function readTrustedAuthMemberId(user: DeleteProgramAuthUser): string {
  return typeof user.app_metadata?.member_id === "string" ? normalizeString(user.app_metadata.member_id) : "";
}

/**
 * Derive role from JWT only. Never trust client `requestedBy`.
 * Missing role defaults to member (safe), except staff-domain trainers without a linked member id.
 */
export function resolveDeleteTrainingProgramRole(user: DeleteProgramAuthUser): "member" | "trainer" {
  const appRole = normalizeString(user.app_metadata?.role).toLowerCase();
  if (appRole === "member" || appRole === "trainer") return appRole;
  const email = normalizeEmail(user.email);
  if (email.endsWith(TRAINER_EMAIL_DOMAIN) && !readTrustedAuthMemberId(user)) return "trainer";
  return "member";
}

export function isSharedMedlemRow(row: DeleteProgramMemberRow | null | undefined): boolean {
  return normalizeString(row?.customer_type).toLowerCase() === "medlem";
}

/**
 * Members may only act on roster rows already resolved into the server-authorized scope
 * (authenticated email / verified trusted member id). Client-supplied memberIds / targetEmail
 * must never appear in that scope unless independently verified.
 */
export function isAuthorizedMemberProgramTarget(input: {
  programMemberId: string;
  authorizedMemberIds: Iterable<string>;
}): boolean {
  const programMemberId = normalizeString(input.programMemberId);
  if (!programMemberId || programMemberId === "__template__") return false;
  const authorized = new Set(
    [...input.authorizedMemberIds].map(normalizeString).filter((id) => id && id !== "__template__"),
  );
  return authorized.has(programMemberId);
}

export function canTrainerDeleteProgram(input: {
  requesterUserId: string;
  programOwnerUserId: string;
  memberRow: DeleteProgramMemberRow | null;
}): boolean {
  const requesterUserId = normalizeString(input.requesterUserId);
  if (!requesterUserId) return false;
  if (normalizeString(input.programOwnerUserId) === requesterUserId) return true;
  if (isSharedMedlemRow(input.memberRow)) return true;
  return normalizeString(input.memberRow?.owner_user_id) === requesterUserId;
}

/**
 * Build the member-id fanout used for linked fingerprint deletes.
 * Client hints may only INTERSECT an already-authorized server scope — never expand it.
 */
export function resolveAuthorizedDeletionMemberIds(input: {
  programMemberId: string;
  authorizedMemberIds: Iterable<string>;
  clientMemberIds?: Iterable<string> | null;
}): string[] {
  const programMemberId = normalizeString(input.programMemberId);
  const authorized = new Set(
    [...input.authorizedMemberIds].map(normalizeString).filter((id) => id && id !== "__template__"),
  );
  if (programMemberId && programMemberId !== "__template__") authorized.add(programMemberId);

  const clientIds = [...(input.clientMemberIds ?? [])].map(normalizeString).filter(Boolean);
  if (!clientIds.length) return Array.from(authorized);

  return clientIds.filter((id) => authorized.has(id));
}
