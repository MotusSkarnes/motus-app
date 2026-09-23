export type PersistWorkoutLogMemberRow = {
  id?: unknown;
  email?: unknown;
  owner_user_id?: unknown;
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

/** Only trust admin-controlled app_metadata.member_id — never mutable user_metadata. */
export function readTrustedAuthMemberId(user: AuthUserIdentity): string {
  return typeof user.app_metadata?.member_id === "string" ? normalizeString(user.app_metadata.member_id) : "";
}

export function resolvePersistWorkoutLogRole(user: AuthUserIdentity): "member" | "trainer" | "" {
  const appRole = normalizeString(user.app_metadata?.role).toLowerCase();
  if (appRole === "member" || appRole === "trainer") return appRole;
  const userRole = normalizeString(user.user_metadata?.role).toLowerCase();
  if (userRole === "member" || userRole === "trainer") return userRole;
  return "";
}

/**
 * Authorize a service-role workout-log write.
 * Synthetic JWT ids like `auth-<userId>` must never authorize an arbitrary target row.
 */
export function canPersistWorkoutLogForMember(input: {
  requesterId: string;
  requesterEmail: string;
  requesterRole: string;
  trustedMemberId: string;
  requestedMemberId: string;
  memberRow: PersistWorkoutLogMemberRow;
}): boolean {
  const rowId = normalizeString(input.memberRow.id);
  const rowEmail = normalizeEmail(input.memberRow.email);
  const rowOwner = normalizeString(input.memberRow.owner_user_id);
  const requesterId = normalizeString(input.requesterId);
  const requesterEmail = normalizeEmail(input.requesterEmail);
  const trustedMemberId = normalizeString(input.trustedMemberId);
  const requestedMemberId = normalizeString(input.requestedMemberId);

  if (input.memberRow.is_active === false) return false;

  if (input.requesterRole === "trainer" && rowOwner && rowOwner === requesterId) return true;

  if (requesterEmail && rowEmail && requesterEmail === rowEmail) return true;

  if (trustedMemberId && (trustedMemberId === rowId || trustedMemberId === requestedMemberId)) {
    return true;
  }

  return false;
}

/** Client owner hints may fill a missing owner, but must not overwrite an existing trainer owner. */
export function resolveWorkoutLogOwnerUserId(input: {
  memberOwner: string;
  ownerUserIdHint: string;
  requesterId: string;
  requesterRole: string;
}): string {
  const memberOwner = normalizeString(input.memberOwner);
  const hint = normalizeString(input.ownerUserIdHint);
  const requesterId = normalizeString(input.requesterId);
  if (memberOwner) return memberOwner;
  if (hint && hint !== requesterId) return hint;
  if (input.requesterRole === "trainer" && requesterId) return requesterId;
  return "";
}
