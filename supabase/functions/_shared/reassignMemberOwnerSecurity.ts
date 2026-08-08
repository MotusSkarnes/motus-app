export type ReassignAuthUser = {
  id?: string;
  email?: string | null;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
};

const TRAINER_EMAIL_DOMAIN = "@motus-skarnes.no";

function normalizeString(value: unknown): string {
  return String(value ?? "").trim();
}

export function normalizeReassignEmail(value: unknown): string {
  return normalizeString(value).toLowerCase();
}

/** Only trust admin-controlled app_metadata.member_id — never mutable user_metadata. */
export function readTrustedAuthMemberId(user: ReassignAuthUser): string {
  return typeof user.app_metadata?.member_id === "string"
    ? normalizeString(user.app_metadata.member_id)
    : "";
}

/**
 * Trainer privileges for customer ownership transfer must never come from mutable
 * user_metadata.role. Staff-domain accounts linked as customers stay members.
 *
 * Used for both the caller gate and eligible transfer-target listing so a forged
 * user_metadata.role cannot enumerate PTs or appear as a reassignment recipient.
 */
export function isTrustedTrainerUser(user: ReassignAuthUser): boolean {
  const appRole = normalizeString(user.app_metadata?.role).toLowerCase();
  if (appRole === "member") return false;
  if (appRole === "trainer") return true;

  const email = normalizeReassignEmail(user.email);
  if (email.endsWith(TRAINER_EMAIL_DOMAIN) && !readTrustedAuthMemberId(user)) return true;
  return false;
}
