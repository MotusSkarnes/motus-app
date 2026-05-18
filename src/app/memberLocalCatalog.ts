import { getSupabaseBootstrapState } from "./data";
import type { AppState, Member, TrainingProgram, WorkoutLog } from "./types";

export const CATALOG_SCHEMA_VERSION = 3;
export const CATALOG_SCHEMA_VERSION_KEY = "motus.catalogSchemaVersion";
export const SESSION_OWNER_EMAIL_KEY = "motus.sessionOwnerEmail";

const DEMO_MEMBER_ID_PATTERN = /^m\d+$/;
const DEMO_SEED_MEMBER_NAMES = new Set(["emma hansen", "martin johansen"]);

export function isDemoSeedMemberId(memberId: string): boolean {
  return DEMO_MEMBER_ID_PATTERN.test(memberId.trim());
}

/** Demo-navn på ekte e-post (feil merge fra localStorage) — skal aldri synkes til sky eller vises som innlogget bruker. */
export function isContaminatedDemoMemberProfile(member: Pick<Member, "id" | "name" | "email">): boolean {
  if (isDemoSeedMemberId(member.id)) return true;
  const name = member.name.trim().toLowerCase();
  if (!DEMO_SEED_MEMBER_NAMES.has(name)) return false;
  const email = member.email.trim().toLowerCase();
  return Boolean(email.includes("@") && !email.endsWith("@example.com"));
}

export function stripDemoSeedCatalog<T extends Pick<AppState, "members" | "programs" | "logs">>(state: T): T {
  const contaminatedIds = new Set(
    state.members.filter((member) => isContaminatedDemoMemberProfile(member)).map((member) => member.id),
  );
  if (!contaminatedIds.size) return state;
  return {
    ...state,
    members: state.members.filter((member) => !contaminatedIds.has(member.id)),
    programs: state.programs.filter((program) => !contaminatedIds.has(program.memberId.trim())),
    logs: state.logs.filter((log) => !contaminatedIds.has(log.memberId.trim())),
  };
}

export function migrateCatalogSchemaVersion(): void {
  if (typeof window === "undefined") return;
  const stored = window.localStorage.getItem(CATALOG_SCHEMA_VERSION_KEY);
  if (stored === String(CATALOG_SCHEMA_VERSION)) return;
  window.localStorage.removeItem("motus_pt_app_v2");
  window.localStorage.setItem(CATALOG_SCHEMA_VERSION_KEY, String(CATALOG_SCHEMA_VERSION));
}

export function readSessionOwnerEmail(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(SESSION_OWNER_EMAIL_KEY)?.trim().toLowerCase() ?? "";
}

export function rememberSessionOwnerEmail(email: string): void {
  if (typeof window === "undefined") return;
  const normalized = email.trim().toLowerCase();
  if (!normalized.includes("@")) return;
  window.localStorage.setItem(SESSION_OWNER_EMAIL_KEY, normalized);
}

export function clearSessionOwnerEmail(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SESSION_OWNER_EMAIL_KEY);
}

/** True when a different member signs in on the same browser (stale catalog must be dropped). */
export function sessionOwnerEmailChanged(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  if (!normalized.includes("@")) return false;
  const stored = readSessionOwnerEmail();
  if (!stored) return false;
  return stored !== normalized;
}

export function resetCatalogForSessionOwnerChange(state: AppState): AppState {
  const bootstrap = getSupabaseBootstrapState();
  return {
    ...state,
    members: [],
    programs: [],
    logs: [],
    messages: [],
    selectedMemberId: "",
    memberViewId: "",
    exercises: bootstrap.exercises,
  };
}

export function filterMembersForSessionEmail(members: Member[], sessionEmail: string): Member[] {
  const normalized = sessionEmail.trim().toLowerCase();
  if (!normalized.includes("@")) return members;
  return members.filter((member) => member.email.trim().toLowerCase() === normalized);
}

export function collectCanonicalMemberIds(
  members: Member[],
  programs: TrainingProgram[],
  logs: WorkoutLog[],
): Set<string> {
  const ids = new Set<string>();
  for (const member of members) {
    const id = member.id.trim();
    if (id) ids.add(id);
  }
  for (const program of programs) {
    const id = program.memberId.trim();
    if (id) ids.add(id);
  }
  for (const log of logs) {
    const id = log.memberId.trim();
    if (id) ids.add(id);
  }
  return ids;
}
