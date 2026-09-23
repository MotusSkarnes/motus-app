export type ProgramSaveRole = "member" | "trainer";

export type ProgramSaveUser = {
  id?: string;
  email?: string | null;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
};

export type ProgramSaveMemberRow = {
  id?: unknown;
  email?: unknown;
  owner_user_id?: unknown;
  customer_type?: unknown;
  membership_type?: unknown;
};

const TRAINER_EMAIL_DOMAIN = "@motus-skarnes.no";

export function normalizeProgramSaveEmail(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeRole(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function readLinkedMemberId(user: ProgramSaveUser): string {
  const raw =
    (typeof user.app_metadata?.member_id === "string" && user.app_metadata.member_id) ||
    (typeof user.user_metadata?.member_id === "string" && user.user_metadata.member_id) ||
    "";
  return raw.trim();
}

export function isTrainerStaffEmail(email: string): boolean {
  return normalizeProgramSaveEmail(email).endsWith(TRAINER_EMAIL_DOMAIN);
}

export function isSharedMedlemMemberRow(row: ProgramSaveMemberRow): boolean {
  return (
    String(row.customer_type ?? "").trim().toLowerCase() === "medlem" &&
    String(row.membership_type ?? "").trim().toLowerCase() !== "premium"
  );
}

/**
 * Match the client `resolveSessionAuthRole` default: invited customers with empty
 * JWT metadata are members. Never default unknown users to trainer.
 */
export function resolveSaveTrainingProgramRole(user: ProgramSaveUser): ProgramSaveRole {
  const email = normalizeProgramSaveEmail(user.email);
  const appRole = normalizeRole(user.app_metadata?.role);
  const userRole = normalizeRole(user.user_metadata?.role);
  const memberId = readLinkedMemberId(user);

  if (appRole === "member" || userRole === "member") return "member";
  if (memberId && memberId !== "__template__") return "member";
  if (appRole === "trainer") return "trainer";
  if (isTrainerStaffEmail(email) && !memberId) return "trainer";
  if (userRole === "trainer") return "trainer";
  if (isTrainerStaffEmail(email)) return "trainer";
  return "member";
}

/** Org-wide template writes must not trust mutable user_metadata.role. */
export function isTrustedTrainerForProgramWrite(user: ProgramSaveUser): boolean {
  const appRole = normalizeRole(user.app_metadata?.role);
  const memberId = String(user.app_metadata?.member_id ?? "").trim();
  if (appRole === "member" || (memberId && memberId !== "__template__")) return false;
  if (appRole === "trainer") return true;
  return isTrainerStaffEmail(String(user.email ?? ""));
}

export function canTrainerWriteMemberRow(
  requesterId: string,
  row: ProgramSaveMemberRow,
  trustedTrainer: boolean,
): boolean {
  const ownerUserId = String(row.owner_user_id ?? "").trim();
  if (requesterId && ownerUserId === requesterId) return true;
  return trustedTrainer && isSharedMedlemMemberRow(row);
}

export function isSameMemberRow(user: ProgramSaveUser, row: ProgramSaveMemberRow): boolean {
  const rowId = String(row.id ?? "").trim();
  const jwtMemberId = String(user.app_metadata?.member_id ?? "").trim();
  if (jwtMemberId && jwtMemberId === rowId) return true;
  const userEmail = normalizeProgramSaveEmail(user.email);
  const rowEmail = normalizeProgramSaveEmail(row.email);
  return Boolean(userEmail && rowEmail && userEmail === rowEmail);
}

export function filterAuthorizedProgramMemberRows(
  user: ProgramSaveUser,
  role: ProgramSaveRole,
  rows: ProgramSaveMemberRow[],
): ProgramSaveMemberRow[] {
  const requesterId = String(user.id ?? "").trim();
  const trustedTrainer = isTrustedTrainerForProgramWrite(user);
  return rows.filter((row) => {
    const id = String(row.id ?? "").trim();
    if (!id || id === "__template__") return false;
    if (role === "member") return isSameMemberRow(user, row);
    return canTrainerWriteMemberRow(requesterId, row, trustedTrainer);
  });
}
