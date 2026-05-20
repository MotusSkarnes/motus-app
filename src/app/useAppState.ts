import { useEffect, useRef, useState } from "react";
import { STORAGE_KEY, demoUsers, getDefaultState } from "./data";
import { loadState, saveState } from "./storage";
import {
  createMember,
  localAppRepository,
  type CreateMemberInput,
  type CreateMemberResult,
  type FinishWorkoutInput,
  type LogCompletedPlanEntryInput,
  type LogGroupWorkoutInput,
  type LogIntervalWorkoutInput,
  type RemoveCompletedPlanEntryLogInput,
  type RemoveGroupWorkoutLogInput,
  type RemoveWorkoutLogResultInput,
  type ReplaceWorkoutExerciseGroupInput,
  type SaveExerciseInput,
  type SaveProgramInput,
  type SetWorkoutLogResultsInput,
  type StartCustomWorkoutInput,
  type StartWorkoutModeOptions,
  type UpdateMemberInput,
} from "../services/appRepository";
import {
  clearSessionOwnerEmail,
  filterMembersForSessionEmail,
  memberIdsForSessionEmail,
  rememberSessionOwnerEmail,
  resetCatalogForSessionOwnerChange,
  sessionOwnerEmailChanged,
  stripDemoSeedCatalog,
} from "./memberLocalCatalog";
import { pickBestPersonalGoals } from "./memberProfileGoals";
import {
  clearPausedWorkoutForProgram,
  discardPausedWorkoutDraftForMember,
  dismissWorkoutModeInState,
  persistPausedWorkoutFromState,
  resumePausedWorkoutInState,
} from "./pausedWorkoutSession";
import { getPausedWorkoutById, purgeExpiredPausedWorkouts } from "./pausedWorkoutStorage";
import { notifyInspirationItemsChanged, saveInspirationItemsToStorage } from "./inspirationStorage";
import { isSupabaseConfigured, supabaseClient } from "../services/supabaseClient";
import { syncMemberLocalCatalogToSupabase } from "../services/supabaseRepository";
import {
  fetchExercisesFromSupabase,
  checkMemberAccessBlocked,
  fetchHydratedMemberData,
  fetchHydratedTrainerData,
  fetchLogsFromSupabase,
  fetchMembersFromSupabase,
  fetchMessagesFromSupabase,
  fetchProgramsFromSupabase,
  registerMessagesPersistedListener,
  reassignMemberOwnerFromSupabase,
  createTrainerMemberViaEdgeFunction,
  restoreMemberByEmailFromSupabase,
  type RestoreMemberOptions,
  supabaseAppRepository,
  type HydratedMemberData,
} from "../services/supabaseRepository";
import { isMemberAppAccessBlocked, MEMBER_ARCHIVED_APP_MESSAGE } from "../services/memberAccessRules";
import {
  ensureAuthSessionForPasswordUpdate,
  ensureMemberAuthLink,
  establishRecoverySessionFromTokens,
  establishSessionFromAuthBootstrap,
  getSupabaseSessionUser,
  mapSupabaseUserToAuthUser,
  resolveSessionAuthRole,
  inviteMemberByEmail,
  inviteTrainerByEmail,
  refreshSupabaseSessionUser,
  requestEmailOtpSignIn,
  requestPasswordRecovery,
  signInWithSupabase,
  signOutSupabase,
  updateSupabasePassword,
  verifyEmailOtpSignIn,
  type InviteMemberResult,
  type InviteTrainerResult,
} from "../services/supabaseAuth";
import {
  clearPersistedAuthBootstrapParams,
  hasAuthBootstrapSecrets,
  persistAuthBootstrapParams,
  readAuthParamsFromLocation,
  readPersistedAuthBootstrapParams,
} from "./supabaseAuthBootstrap";
import { parseStoredLogDate } from "./dateFormat";
import {
  isLegacyIntervalCooldownDrag,
  normalizeLegacyIntervalCooldownExerciseNames,
  normalizeProgramsLegacyCooldownNames,
} from "./programBlocks";
import { mergeRemoteMessagesWithLocalOptimistic } from "./messageHydrationMerge";
import type {
  AppState,
  AuthUser,
  Exercise,
  Member,
  MemberProgramLibraryStatus,
  MemberTab,
  PeriodSchedulePlan,
  TrainerTab,
  ProgramExercise,
  TrainingProgram,
  WorkoutLog,
} from "./types";

/** Ved hydrering kan flere rader ha samme e-post; slå sammen mot riktig rad (ikke første treff — ofte Medlem-dup før PT-raden). */
function resolveMemberRowMergeIndex(remoteMembers: Member[], localMember: Member): number {
  const idIdx = remoteMembers.findIndex((m) => m.id === localMember.id);
  if (idIdx >= 0) return idIdx;
  const emailKey = localMember.email.trim().toLowerCase();
  const matches = remoteMembers
    .map((m, index) => ({ m, index }))
    .filter(({ m }) => m.email.trim().toLowerCase() === emailKey);
  if (!matches.length) return -1;
  if (matches.length === 1) return matches[0].index;
  const preferred =
    matches.find(({ m }) => m.customerType === "PT-kunde") ??
    matches.find(({ m }) => m.membershipType === "Premium") ??
    matches.find(({ m }) => m.customerType !== "Medlem") ??
    matches[0];
  return preferred.index;
}

/** Slå sammen to medlemssnapshot fra hydrate vs direkte fetch uten at tom invitedAt overskriver en gyldig verdi. */
function mergeTwoMemberSnapshots(primary: Member, secondary: Member): Member {
  const merged = { ...primary, ...secondary };
  const pInv = primary.invitedAt?.trim();
  const sInv = secondary.invitedAt?.trim();
  merged.invitedAt = sInv || pInv || "";
  merged.personalGoals =
    pickBestPersonalGoals([primary.personalGoals, secondary.personalGoals, merged.personalGoals]) || merged.personalGoals;
  // Aktiv i sky skal ikke overskrives av inaktiv lokal klient-tilstand etter gjenoppretting.
  merged.isActive = primary.isActive !== false || secondary.isActive !== false;
  return merged;
}

function mergeMembersById(primary: AppState["members"] | null, secondary: AppState["members"] | null): AppState["members"] | null {
  if (!primary && !secondary) return null;
  const merged = new Map<string, AppState["members"][number]>();
  for (const member of [...(primary ?? []), ...(secondary ?? [])]) {
    const key = member.id.trim() || member.email.trim().toLowerCase();
    if (!key) continue;
    const existing = merged.get(key);
    merged.set(key, existing ? mergeTwoMemberSnapshots(existing, member) : member);
  }
  return Array.from(merged.values());
}

/** Nylig opprettede kunder kan mangle i sky-listen i noen sekunder etter create. */
const TRAINER_MEMBER_PIN_MS = 120_000;

function mergeTrainerMembersWithLocalAndPinned(
  remoteMembers: AppState["members"],
  localMembers: AppState["members"],
  pinnedMembers: Member[],
): AppState["members"] {
  let merged = mergeMembersById(remoteMembers, localMembers) ?? remoteMembers;
  merged = mergeMembersById(merged, pinnedMembers) ?? merged;

  const remoteIds = new Set(merged.map((member) => member.id.trim()).filter(Boolean));
  const remoteEmails = new Set(
    merged.map((member) => member.email.trim().toLowerCase()).filter((email) => email.includes("@")),
  );
  const keepLocal: Member[] = [];
  for (const local of [...localMembers, ...pinnedMembers]) {
    if (local.isActive === false) continue;
    const email = local.email.trim().toLowerCase();
    const inRemote = remoteIds.has(local.id.trim()) || (email.includes("@") && remoteEmails.has(email));
    if (!inRemote) keepLocal.push(local);
  }
  if (keepLocal.length) {
    merged = mergeMembersById(merged, keepLocal) ?? merged;
  }
  return merged;
}

function preserveTrainerInvitedAtFromLocal(
  mergedMembers: AppState["members"],
  prevMembers: AppState["members"],
): AppState["members"] {
  return mergedMembers.map((remote) => {
    const prevRow = prevMembers.find((member) => member.id === remote.id);
    const prevInv = prevRow?.invitedAt?.trim();
    const remoteInv = remote.invitedAt?.trim();
    if (prevInv && !remoteInv) {
      return { ...remote, invitedAt: prevInv };
    }
    return remote;
  });
}

function mergeMemberLibraryStatus(
  remote: MemberProgramLibraryStatus | undefined,
  local: MemberProgramLibraryStatus | undefined,
): MemberProgramLibraryStatus | undefined {
  return remote ?? local;
}

function mergeTrainingProgramSnapshots(primary: TrainingProgram, secondary: TrainingProgram): TrainingProgram {
  return {
    ...primary,
    ...secondary,
    memberLibraryStatus: mergeMemberLibraryStatus(secondary.memberLibraryStatus, primary.memberLibraryStatus),
  };
}

/** Union hydrate + direct table fetch so rows visible under RLS are not dropped when edge list is partial. */
function mergeTrainingProgramsById(
  hydrated: TrainingProgram[] | null | undefined,
  direct: TrainingProgram[] | null | undefined,
): TrainingProgram[] {
  const byId = new Map<string, TrainingProgram>();
  for (const p of hydrated ?? []) {
    const id = p.id?.trim();
    if (id) byId.set(id, p);
  }
  for (const p of direct ?? []) {
    const id = p.id?.trim();
    if (!id) continue;
    const existing = byId.get(id);
    byId.set(id, existing ? mergeTrainingProgramSnapshots(existing, p) : p);
  }
  return Array.from(byId.values());
}

function mergeRemoteProgramsWithLocal(remotePrograms: TrainingProgram[], localPrograms: TrainingProgram[]): TrainingProgram[] {
  const localById = new Map(localPrograms.map((program) => [program.id, program]));
  return remotePrograms.map((remoteProgram) => {
    const localProgram = localById.get(remoteProgram.id);
    if (!localProgram) return remoteProgram;
    return mergeTrainingProgramSnapshots(localProgram, remoteProgram);
  });
}

function visibleMemberIdSet(members: Member[]): Set<string> {
  return new Set(members.map((member) => member.id.trim()).filter(Boolean));
}

function filterProgramsForMembers(programs: TrainingProgram[], memberIds: Set<string>): TrainingProgram[] {
  if (!memberIds.size) return programs;
  return programs.filter((program) => memberIds.has(program.memberId.trim()));
}

/** Behold midlertidige økter og aktivt program under sky-synk — ellers lukkes øktmodus for «Start egen økt». */
function mergeMemberProgramsWithLocalEphemeral(
  remotePrograms: TrainingProgram[],
  prevPrograms: TrainingProgram[],
  memberIds: Set<string>,
  activeWorkoutProgramId?: string,
): TrainingProgram[] {
  const merged = new Map(filterProgramsForMembers(remotePrograms, memberIds).map((program) => [program.id, program]));
  for (const local of prevPrograms) {
    if (!memberIds.has(local.memberId.trim())) continue;
    const keepEphemeral = local.ephemeral === true;
    const keepActiveWorkout = Boolean(activeWorkoutProgramId && local.id === activeWorkoutProgramId);
    if (!keepEphemeral && !keepActiveWorkout) continue;
    if (!merged.has(local.id)) merged.set(local.id, local);
  }
  return Array.from(merged.values());
}

function filterLogsForMembers(logs: WorkoutLog[], memberIds: Set<string>): WorkoutLog[] {
  if (!memberIds.size) return logs;
  return logs.filter((log) => memberIds.has(log.memberId.trim()));
}

function mergeWorkoutLogsById(
  hydrated: WorkoutLog[] | null | undefined,
  direct: WorkoutLog[] | null | undefined,
): WorkoutLog[] {
  const byId = new Map<string, WorkoutLog>();
  for (const l of hydrated ?? []) {
    const id = l.id?.trim();
    if (id) byId.set(id, l);
  }
  for (const l of direct ?? []) {
    const id = l.id?.trim();
    if (id) byId.set(id, l);
  }
  return Array.from(byId.values());
}

const LOCAL_OPTIMISTIC_WORKOUT_LOG_KEEP_MS = 48 * 60 * 60 * 1000;

function workoutLogDateMs(log: WorkoutLog): number {
  return parseStoredLogDate(log.date)?.getTime() ?? 0;
}

function mergeRemoteWorkoutLogsWithLocalOptimistic(
  remoteLogs: WorkoutLog[],
  localLogs: WorkoutLog[],
  visibleMembers: Member[],
  nowMs = Date.now(),
): WorkoutLog[] {
  const visibleMemberIds = new Set(visibleMembers.map((member) => member.id.trim()).filter(Boolean));
  const byId = new Map<string, WorkoutLog>();
  for (const log of remoteLogs) {
    const id = log.id.trim();
    if (id) byId.set(id, log);
  }

  for (const localLog of localLogs) {
    const id = localLog.id.trim();
    if (!id || byId.has(id)) continue;
    if (!visibleMemberIds.has(localLog.memberId.trim())) continue;
    const dateMs = workoutLogDateMs(localLog);
    if (!dateMs) continue;
    const ageMs = nowMs - dateMs;
    if (ageMs < 0 || ageMs > LOCAL_OPTIMISTIC_WORKOUT_LOG_KEEP_MS) continue;
    byId.set(id, localLog);
  }

  return Array.from(byId.values()).sort((a, b) => workoutLogDateMs(b) - workoutLogDateMs(a));
}

function appendExercisesFromProgramRows(
  exercisesById: Map<string, Exercise>,
  exercisesByName: Map<string, Exercise>,
  rows: ProgramExercise[],
): Exercise[] {
  const appendedExercises: Exercise[] = [];
  rows.forEach((programExercise) => {
    const exerciseId = programExercise.exerciseId.trim();
    const exerciseName = programExercise.exerciseName.trim();
    if (!exerciseId && !exerciseName) return;
    if (exerciseId && exercisesById.has(exerciseId)) return;
    if (exerciseName && exercisesByName.has(exerciseName.toLowerCase())) return;

    const nextExercise: Exercise = {
      id: exerciseId || `ex_${exerciseName.toLowerCase().replace(/\s+/g, "_")}`,
      name: exerciseName || "Ny øvelse",
      category: "Styrke",
      group: "Fra program",
      equipment: "Uspesifisert",
      level: "Nybegynner",
      description: "Lagt til automatisk fra program.",
    };
    appendedExercises.push(nextExercise);
    exercisesById.set(nextExercise.id, nextExercise);
    exercisesByName.set(nextExercise.name.trim().toLowerCase(), nextExercise);
  });
  return appendedExercises;
}

function normalizeProgramExerciseNames(
  program: TrainingProgram,
  exercisesById: Map<string, Exercise>,
): TrainingProgram {
  const legacyNormalizedExercises = normalizeLegacyIntervalCooldownExerciseNames(program.exercises);
  let programChanged = legacyNormalizedExercises !== program.exercises;
  const normalizedExercises = legacyNormalizedExercises.map((programExercise, index) => {
    if (programExercise.exerciseName === "Nedjogg" || isLegacyIntervalCooldownDrag(legacyNormalizedExercises, index)) {
      if (programExercise.exerciseName === "Nedjogg") return programExercise;
      programChanged = true;
      return { ...programExercise, exerciseName: "Nedjogg" };
    }
    const source = exercisesById.get(programExercise.exerciseId.trim());
    if (!source || source.name === programExercise.exerciseName) return programExercise;
    programChanged = true;
    return { ...programExercise, exerciseName: source.name };
  });
  if (!programChanged) return program;
  return { ...program, exercises: normalizedExercises };
}

/** Full catalog sync after hydrate — can be expensive with many programs. */
function syncExercisesWithPrograms(state: AppState): AppState {
  const exercisesById = new Map(state.exercises.map((exercise) => [exercise.id, exercise]));
  const exercisesByName = new Map(state.exercises.map((exercise) => [exercise.name.trim().toLowerCase(), exercise]));
  const appendedExercises: Exercise[] = [];
  state.programs.forEach((program) => {
    appendedExercises.push(...appendExercisesFromProgramRows(exercisesById, exercisesByName, program.exercises));
  });

  let hasProgramNameFix = false;
  const normalizedPrograms = state.programs.map((program) => {
    const normalized = normalizeProgramExerciseNames(program, exercisesById);
    if (normalized !== program) hasProgramNameFix = true;
    return normalized;
  });

  if (!appendedExercises.length && !hasProgramNameFix) return state;
  return {
    ...state,
    exercises: [...state.exercises, ...appendedExercises],
    programs: normalizedPrograms,
  };
}

/** Fast path when saving one program — avoids scanning the entire trainer catalog. */
function syncExercisesWithProgramsAfterSave(state: AppState, input: SaveProgramInput): AppState {
  const exercisesById = new Map(state.exercises.map((exercise) => [exercise.id, exercise]));
  const exercisesByName = new Map(state.exercises.map((exercise) => [exercise.name.trim().toLowerCase(), exercise]));
  const appendedExercises = appendExercisesFromProgramRows(exercisesById, exercisesByName, input.exercises);

  const trimmedProgramId = String(input.id ?? "").trim();
  const trimmedTitle = input.title.trim();
  const shouldNormalizeProgram = (program: TrainingProgram) => {
    if (trimmedProgramId) return program.id === trimmedProgramId;
    return program.memberId === input.memberId && program.title.trim() === trimmedTitle;
  };

  let hasProgramNameFix = false;
  const normalizedPrograms = state.programs.map((program) => {
    if (!shouldNormalizeProgram(program)) return program;
    const normalized = normalizeProgramExerciseNames(program, exercisesById);
    if (normalized !== program) hasProgramNameFix = true;
    return normalized;
  });

  if (!appendedExercises.length && !hasProgramNameFix) return state;
  return {
    ...state,
    exercises: [...state.exercises, ...appendedExercises],
    programs: normalizedPrograms,
  };
}

/** Parse invite/recovery på første render slik at hydrate-session ikke kjører før passordskjerm er aktiv. */
function captureInitialSupabaseAuthUrl(): {
  isRecoveryMode: boolean;
  recoveryInviteFlow: boolean;
  recoveryTokenHash: string | null;
  recoveryAccessToken: string | null;
  recoveryRefreshToken: string | null;
  recoveryAuthCode: string | null;
  recoveryInfo: string | null;
  initialRecoveryError: string | null;
} | null {
  if (typeof window === "undefined" || !isSupabaseConfigured) return null;
  const params = readAuthParamsFromLocation(window.location.href);
  if (!params) return null;
  persistAuthBootstrapParams(params);
  const hasSecrets = hasAuthBootstrapSecrets(params);
  const invite = params.recoveryInviteFlow;
  return {
    isRecoveryMode: true,
    recoveryInviteFlow: invite,
    recoveryTokenHash: params.tokenHash,
    recoveryAccessToken: params.accessToken,
    recoveryRefreshToken: params.refreshToken,
    recoveryAuthCode: params.authCode,
    recoveryInfo: hasSecrets ? (invite ? "Verifiserer invitasjon..." : "Verifiserer recovery-lenke...") : null,
    initialRecoveryError: hasSecrets
      ? null
      : invite
        ? "Invitasjonslenken mangler sikkerhetstoken. Åpne lenken direkte fra e-posten på nytt (ikke bare adresselinjen)."
        : "Recovery-lenken mangler sikkerhetstoken. Åpne lenken direkte fra e-posten på nytt.",
  };
}

function stripSensitiveSupabaseAuthFromBrowserUrl(): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  let changed = false;
  for (const key of ["access_token", "refresh_token", "expires_in", "token_type", "provider_token", "token_hash", "type", "code", "invite"]) {
    if (url.searchParams.has(key)) {
      url.searchParams.delete(key);
      changed = true;
    }
  }
  if (window.location.hash.replace(/^#/, "").trim()) {
    url.hash = "";
    changed = true;
  }
  if (changed) {
    window.history.replaceState({}, document.title, `${url.pathname}${url.search}`);
  }
}

const INITIAL_SUPABASE_AUTH_FROM_URL = captureInitialSupabaseAuthUrl();

export function useAppState() {
  const remoteHydrateRef = useRef<(() => Promise<void>) | null>(null);
  const pinnedTrainerMembersRef = useRef(new Map<string, { member: Member; expiresAt: number }>());

  function pinTrainerMember(member: Member) {
    const expiresAt = Date.now() + TRAINER_MEMBER_PIN_MS;
    pinnedTrainerMembersRef.current.set(`id:${member.id.trim()}`, { member, expiresAt });
    const email = member.email.trim().toLowerCase();
    if (email.includes("@")) {
      pinnedTrainerMembersRef.current.set(`email:${email}`, { member, expiresAt });
    }
  }

  function readPinnedTrainerMembers(): Member[] {
    const now = Date.now();
    const byId = new Map<string, Member>();
    for (const [key, entry] of pinnedTrainerMembersRef.current.entries()) {
      if (entry.expiresAt <= now) {
        pinnedTrainerMembersRef.current.delete(key);
        continue;
      }
      byId.set(entry.member.id, entry.member);
    }
    return Array.from(byId.values());
  }
  const isDemoMode = import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEMO_MODE === "true";
  const repository = isSupabaseConfigured ? supabaseAppRepository : localAppRepository;
  const [appState, setAppState] = useState<AppState>(() => loadState());
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isRecoveryMode, setIsRecoveryMode] = useState(() => INITIAL_SUPABASE_AUTH_FROM_URL?.isRecoveryMode ?? false);
  const [isAuthSessionLoading, setIsAuthSessionLoading] = useState(
    () => isSupabaseConfigured && !(INITIAL_SUPABASE_AUTH_FROM_URL?.isRecoveryMode ?? false),
  );
  const [recoveryInviteFlow, setRecoveryInviteFlow] = useState(() => INITIAL_SUPABASE_AUTH_FROM_URL?.recoveryInviteFlow ?? false);
  const [recoveryTokenHash, setRecoveryTokenHash] = useState<string | null>(() => INITIAL_SUPABASE_AUTH_FROM_URL?.recoveryTokenHash ?? null);
  const [recoveryAccessToken, setRecoveryAccessToken] = useState<string | null>(
    () => INITIAL_SUPABASE_AUTH_FROM_URL?.recoveryAccessToken ?? null,
  );
  const [recoveryRefreshToken, setRecoveryRefreshToken] = useState<string | null>(
    () => INITIAL_SUPABASE_AUTH_FROM_URL?.recoveryRefreshToken ?? null,
  );
  const [recoveryAuthCode, setRecoveryAuthCode] = useState<string | null>(
    () => INITIAL_SUPABASE_AUTH_FROM_URL?.recoveryAuthCode ?? null,
  );
  const [recoverySessionReady, setRecoverySessionReady] = useState(false);
  const [recoveryPassword, setRecoveryPassword] = useState("");
  const [recoveryPasswordConfirm, setRecoveryPasswordConfirm] = useState("");
  const [recoveryError, setRecoveryError] = useState<string | null>(
    () => INITIAL_SUPABASE_AUTH_FROM_URL?.initialRecoveryError ?? null,
  );
  const [recoveryInfo, setRecoveryInfo] = useState<string | null>(() => INITIAL_SUPABASE_AUTH_FROM_URL?.recoveryInfo ?? null);
  const [passwordRecoveryInfo, setPasswordRecoveryInfo] = useState<string | null>(null);
  const [passwordRecoveryError, setPasswordRecoveryError] = useState<string | null>(null);
  const [passwordRecoveryCooldownSeconds, setPasswordRecoveryCooldownSeconds] = useState(0);
  const [otpCode, setOtpCode] = useState("");
  const [otpInfo, setOtpInfo] = useState<string | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [trainerTab, setTrainerTab] = useState<TrainerTab>("dashboard");
  const [memberTab, setMemberTab] = useState<MemberTab>("overview");
  const [isLocalDemoSession, setIsLocalDemoSession] = useState(false);
  const [remoteTrainerPeriodPlansByMemberId, setRemoteTrainerPeriodPlansByMemberId] = useState<Record<string, PeriodSchedulePlan[]>>(
    {},
  );
  const [remoteMemberPeriodPlanRows, setRemoteMemberPeriodPlanRows] = useState<Array<{ memberId: string; plan: PeriodSchedulePlan }>>(
    [],
  );

  function applyMemberSessionBaseState(state: AppState, user: AuthUser): AppState {
    let base = stripDemoSeedCatalog(state);
    if (user.role === "member") {
      const email = user.email.trim().toLowerCase();
      if (sessionOwnerEmailChanged(email)) {
        base = resetCatalogForSessionOwnerChange(base);
      }
      rememberSessionOwnerEmail(email);
    }
    return ensureMemberRecordForUser(base, user, user.memberId ?? base.memberViewId);
  }

  function ensureMemberRecordForUser(state: AppState, user: AuthUser, preferredMemberId?: string): AppState {
    if (user.role !== "member") return state;
    const normalizedEmail = user.email.trim().toLowerCase();
    const resolvedMemberId = (preferredMemberId || user.memberId || `auth-${user.id}`).trim();
    if (!resolvedMemberId && !normalizedEmail) return state;

    const existingById = resolvedMemberId ? state.members.find((member) => member.id === resolvedMemberId) : null;
    const existingByEmail =
      normalizedEmail ? state.members.find((member) => member.email.trim().toLowerCase() === normalizedEmail) : null;
    const idMatchesEmail =
      existingById &&
      normalizedEmail &&
      existingById.email.trim().toLowerCase() === normalizedEmail;
    const existing = idMatchesEmail ? existingById : existingByEmail ?? existingById ?? null;
    if (existing) return state;

    const fallbackMember = {
      id: resolvedMemberId || `auth-${user.id}`,
      name: user.name || "Medlem",
      email: normalizedEmail || "",
      isActive: true,
      invitedAt: "",
      phone: "",
      birthDate: "",
      weight: "",
      height: "",
      level: "Nybegynner" as const,
      membershipType: "Standard" as const,
      customerType: "Medlem" as const,
      daysSinceActivity: "0",
      goal: "",
      focus: "",
      personalGoals: "",
      injuries: "",
      coachNotes: "",
    };

    return {
      ...state,
      members: [...state.members, fallbackMember],
    };
  }

  function resolveMemberViewIdForUser(input: {
    role: AppState["role"];
    memberId?: string;
    email: string;
    members: AppState["members"];
    programs: AppState["programs"];
    fallbackId: string;
  }): string {
    const { role, memberId, email, members, programs, fallbackId } = input;
    if (role !== "member") return fallbackId;
    const normalizedEmail = email.trim().toLowerCase();
    const linkedMemberId = memberId?.trim() ?? "";
    if (linkedMemberId && normalizedEmail) {
      const authLinked = members.find(
        (member) =>
          member.id === linkedMemberId &&
          member.isActive !== false &&
          member.email.trim().toLowerCase() === normalizedEmail,
      );
      if (authLinked) return linkedMemberId;
    }
    const byEmailCandidates = normalizedEmail
      ? members.filter((member) => member.email.trim().toLowerCase() === normalizedEmail && member.isActive !== false)
      : [];
    if (byEmailCandidates.length > 0) {
      const programCountByMemberId = new Map<string, number>();
      programs.forEach((program) => {
        programCountByMemberId.set(program.memberId, (programCountByMemberId.get(program.memberId) ?? 0) + 1);
      });
      const bestCandidate = [...byEmailCandidates].sort((a, b) => {
        const score = (member: (typeof byEmailCandidates)[number]) => {
          let value = 0;
          if (!member.id.trim().startsWith("auth-")) value += 10_000;
          if (member.customerType === "PT-kunde") value += 1_000;
          if (member.membershipType === "Premium") value += 500;
          value += programCountByMemberId.get(member.id) ?? 0;
          if (String(member.personalGoals ?? "").includes("onboardingCompletedAt")) value += 80;
          return value;
        };
        const diff = score(b) - score(a);
        if (diff !== 0) return diff;
        return a.id.localeCompare(b.id);
      })[0];
      if (bestCandidate) return bestCandidate.id;
    }
    if (memberId) {
      const linked = members.find((member) => member.id === memberId);
      if (linked && linked.isActive !== false) return memberId;
    }
    return fallbackId;
  }

  async function blockArchivedMemberAccess(message = MEMBER_ARCHIVED_APP_MESSAGE, email?: string) {
    const normalizedEmail = email?.trim().toLowerCase() ?? "";
    await signOutSupabase();
    setLoginError(message);
    setAppState((prev) => {
      const members =
        normalizedEmail && normalizedEmail.includes("@")
          ? prev.members.map((member) =>
              member.email.trim().toLowerCase() === normalizedEmail ? { ...member, isActive: false } : member,
            )
          : prev.members;
      return {
        ...prev,
        members,
        currentUser: null,
        role: "trainer",
        memberViewId: "",
        selectedMemberId:
          prev.selectedMemberId && members.some((m) => m.id === prev.selectedMemberId && m.isActive !== false)
            ? prev.selectedMemberId
            : "",
      };
    });
  }

  function hydratedMemberAccessDenied(hydratedMember: HydratedMemberData | null): string | null {
    if (!hydratedMember?.accessDenied) return null;
    return hydratedMember.accessDenied.message || MEMBER_ARCHIVED_APP_MESSAGE;
  }

  function toLinkableMemberId(memberId: string | undefined): string | undefined {
    if (!memberId) return undefined;
    const trimmed = memberId.trim();
    if (!trimmed) return undefined;
    // Never sync auth metadata to synthetic local fallback IDs.
    if (trimmed.startsWith("auth-")) return undefined;
    return trimmed;
  }

  useEffect(() => {
    const persisted =
      appState.currentUser && appState.role !== appState.currentUser.role
        ? { ...appState, role: appState.currentUser.role }
        : appState;
    saveState(persisted);
  }, [appState]);

  useEffect(() => {
    purgeExpiredPausedWorkouts();
  }, []);

  useEffect(() => {
    if (appState.currentUser?.role !== "member") return;
    if (!appState.workoutMode) return;
    const timer = window.setTimeout(() => {
      persistPausedWorkoutFromState(appState);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [appState.workoutMode, appState.currentUser?.role, appState.programs]);

  useEffect(() => {
    if (passwordRecoveryCooldownSeconds <= 0) return;
    const timer = window.setTimeout(() => {
      setPasswordRecoveryCooldownSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [passwordRecoveryCooldownSeconds]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    if (appState.currentUser?.role !== "member") return;
    const email = appState.currentUser.email.trim().toLowerCase();
    if (!email.includes("@")) return;

    let cancelled = false;
    async function verifyMemberAccess() {
      if (await checkMemberAccessBlocked(email)) {
        if (!cancelled) await blockArchivedMemberAccess(MEMBER_ARCHIVED_APP_MESSAGE, email);
      }
    }
    void verifyMemberAccess();
    const interval = window.setInterval(() => {
      void verifyMemberAccess();
    }, 12000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [appState.currentUser?.role, appState.currentUser?.email]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    let cancelled = false;

    async function hydrateRemoteData() {
      const {
        data: { session },
      } = supabaseClient ? await supabaseClient.auth.getSession() : { data: { session: null } };
      const sessionUser = session?.user ?? null;
      const sessionRole = sessionUser
        ? resolveSessionAuthRole({
            email: sessionUser.email,
            app_metadata: sessionUser.app_metadata as Record<string, unknown> | undefined,
            user_metadata: sessionUser.user_metadata as Record<string, unknown> | undefined,
          })
        : "";
      const ownerUserId = (() => {
        const token = session?.access_token;
        if (!token) return "";
        try {
          const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))) as { sub?: string };
          return String(payload.sub ?? "");
        } catch {
          return "";
        }
      })();

      const isTrainerSession = sessionRole === "trainer";
      const isMemberLikeSession = Boolean(sessionUser) && !isTrainerSession;
      const hydratedTrainer = isTrainerSession && ownerUserId ? await fetchHydratedTrainerData(ownerUserId) : null;
      const [hydratedMember, directMemberPrograms, directMemberLogs] = await Promise.all([
        isMemberLikeSession ? fetchHydratedMemberData() : Promise.resolve(null),
        isMemberLikeSession ? fetchProgramsFromSupabase() : Promise.resolve(null),
        isMemberLikeSession ? fetchLogsFromSupabase() : Promise.resolve(null),
      ]);
      const sessionEmail = sessionUser?.email?.trim().toLowerCase() ?? "";
      const archivedMessage = hydratedMemberAccessDenied(hydratedMember);
      const accessBlocked =
        isMemberLikeSession && sessionEmail
          ? archivedMessage
            ? true
            : await checkMemberAccessBlocked(sessionEmail)
          : false;
      if (!cancelled && isMemberLikeSession && accessBlocked) {
        await blockArchivedMemberAccess(archivedMessage ?? MEMBER_ARCHIVED_APP_MESSAGE, sessionEmail);
        return;
      }
      const directTrainerMembers = isTrainerSession ? await fetchMembersFromSupabase() : null;
      const remoteMembers = hydratedTrainer
        ? mergeMembersById(hydratedTrainer.members, directTrainerMembers)
        : hydratedMember?.members ?? directTrainerMembers ?? (await fetchMembersFromSupabase());
      const remoteMessages = hydratedTrainer?.messages ?? hydratedMember?.messages ?? (await fetchMessagesFromSupabase());
      // Edge hydrate and RLS-backed selects can disagree; merge by id so new devices still see programs/logs
      // the member can read directly from Postgres even when hydrate returns a partial list.
      let remotePrograms =
        hydratedTrainer?.programs ??
        (isMemberLikeSession ? mergeTrainingProgramsById(hydratedMember?.programs, directMemberPrograms) : null);
      let remoteLogs =
        hydratedTrainer?.logs ??
        (isMemberLikeSession ? mergeWorkoutLogsById(hydratedMember?.logs, directMemberLogs) : null);

      // One-shot: JWT app_metadata.member_id often mismatches DB; RLS then returns no rows. Re-link + refresh + refetch.
      if (
        !cancelled &&
        isMemberLikeSession &&
        supabaseClient &&
        sessionUser?.email &&
        sessionUser.id &&
        Array.isArray(remotePrograms) &&
        remotePrograms.length === 0 &&
        typeof window !== "undefined"
      ) {
        const retryKey = `motus.memberProgramJwtRetry:${sessionUser.id}`;
        if (!window.sessionStorage.getItem(retryKey)) {
          const email = sessionUser.email.trim().toLowerCase();
          let memberId = "";
          if (hydratedMember?.members?.length) {
            const match =
              hydratedMember.members.find((m) => m.email.trim().toLowerCase() === email) ?? hydratedMember.members[0];
            memberId = match?.id?.trim() ?? "";
          }
          if (!memberId && email.includes("@")) {
            const fetchedMembers = await fetchMembersFromSupabase();
            const match =
              fetchedMembers?.find((m) => m.email.trim().toLowerCase() === email) ?? fetchedMembers?.[0] ?? null;
            memberId = match?.id?.trim() ?? "";
          }
          if (email.includes("@") && memberId) {
            window.sessionStorage.setItem(retryKey, "1");
            await ensureMemberAuthLink(email, memberId);
            await supabaseClient.auth.refreshSession();
            const retryPrograms = await fetchProgramsFromSupabase();
            const retryLogs = await fetchLogsFromSupabase();
            if (retryPrograms?.length) {
              remotePrograms = retryPrograms;
            }
            if (retryLogs?.length) {
              remoteLogs = retryLogs;
            }
          }
        }
      }
      const trainerHydrateFailed =
        Boolean(hydratedTrainer) &&
        (hydratedTrainer?.debug?.status === "invoke_error" || hydratedTrainer?.debug?.status === "invalid_payload");
      // Do not trust direct table fetch when it returns [] — RLS often hides rows for members, but [] is still a
      // non-null array; trusting it wiped local state and showed no programs (hydrate is the source of truth).
      const trustRemotePrograms =
        (isTrainerSession && Boolean(hydratedTrainer) && !trainerHydrateFailed) ||
        (isMemberLikeSession && hydratedMember !== null) ||
        (isMemberLikeSession && hydratedMember === null && Array.isArray(directMemberPrograms) && directMemberPrograms.length > 0);
      const trustRemoteLogs =
        (isTrainerSession && Boolean(hydratedTrainer) && !trainerHydrateFailed) ||
        (isMemberLikeSession && hydratedMember !== null) ||
        (isMemberLikeSession && hydratedMember === null && Array.isArray(directMemberLogs) && directMemberLogs.length > 0);
      const remoteExercises =
        hydratedTrainer?.exercises ?? hydratedMember?.exercises ?? (await fetchExercisesFromSupabase());
      if (cancelled) return;

      if (
        isMemberLikeSession &&
        sessionEmail &&
        (isMemberAppAccessBlocked(remoteMembers ?? [], sessionEmail) || (await checkMemberAccessBlocked(sessionEmail)))
      ) {
        await blockArchivedMemberAccess(MEMBER_ARCHIVED_APP_MESSAGE, sessionEmail);
        return;
      }

      if (hydratedTrainer) {
        const trainerHydrateStatus = hydratedTrainer.debug?.status;
        if (trainerHydrateStatus !== "invoke_error" && trainerHydrateStatus !== "invalid_payload") {
          setRemoteTrainerPeriodPlansByMemberId(hydratedTrainer.periodPlansByMemberId ?? {});
        }
      }
      if (hydratedMember) {
        setRemoteMemberPeriodPlanRows(hydratedMember.periodPlanRows ?? []);
        if (!cancelled && hydratedMember.inspirationItems.length > 0) {
          const inspirationSaved = saveInspirationItemsToStorage(hydratedMember.inspirationItems);
          if (inspirationSaved.ok) {
            notifyInspirationItemsChanged();
          }
        }
      }

      let stateAfterHydrate: AppState | null = null;
      setAppState((prev) => {
        const prevStripped = stripDemoSeedCatalog(prev);
        const next = { ...prevStripped };
        const shouldAdoptRemote = <T,>(remoteRows: T[] | null, localRows: T[]) => {
          if (!remoteRows) return false;
          if (remoteRows.length > 0) return true;
          return localRows.length === 0;
        };
        // Safety guard: never let an empty remote response wipe core catalogs.
        // Members and exercise bank should only be replaced when remote has rows.
        const shouldAdoptNonEmptyRemoteOnly = <T,>(remoteRows: T[] | null) => {
          if (!remoteRows) return false;
          return remoteRows.length > 0;
        };

        if (shouldAdoptNonEmptyRemoteOnly(remoteMembers)) {
          let mergedMembers = remoteMembers;
          const currentUser = prevStripped.currentUser;
          if (currentUser?.role === "member") {
            const normalizedUserEmail = currentUser.email.trim().toLowerCase();
            const remoteForEmail = filterMembersForSessionEmail(mergedMembers, normalizedUserEmail);
            const localForEmail = filterMembersForSessionEmail(prevStripped.members, normalizedUserEmail);
            mergedMembers = remoteForEmail.length > 0 ? remoteForEmail : localForEmail;
            const bestGoalsForEmail = pickBestPersonalGoals([
              ...prevStripped.members
                .filter((member) => member.email.trim().toLowerCase() === normalizedUserEmail)
                .map((member) => member.personalGoals),
              ...mergedMembers.map((member) => member.personalGoals),
            ]);
            mergedMembers = mergedMembers.map((member) => ({
              ...member,
              personalGoals: bestGoalsForEmail || member.personalGoals,
            }));
          }
          if (currentUser?.role === "trainer") {
            // Behold nylig opprettede kunder til sky-lagring er ferdig — ellers forsvinner de ved neste hydrate.
            mergedMembers = mergeMembersById(mergedMembers, prevStripped.members) ?? mergedMembers;
            // Remote kan ha tom invitedAt på raden (RLS/direkte fetch vs hydrate) rett etter invitasjon — ikke overskriv optimistisk/lokal verdi.
            mergedMembers = mergedMembers.map((remote) => {
              const prevRow = prev.members.find((m) => m.id === remote.id);
              const prevInv = prevRow?.invitedAt?.trim();
              const remoteInv = remote.invitedAt?.trim();
              if (prevInv && !remoteInv) {
                return { ...remote, invitedAt: prevInv };
              }
              return remote;
            });
          }
          next.members = mergedMembers;
        }

        if (remoteMessages.length > 0) {
          next.messages = mergeRemoteMessagesWithLocalOptimistic(
            remoteMessages,
            prev.messages,
            [...next.members, ...prev.members],
            Date.now(),
          );
        } else if (shouldAdoptRemote(remoteMessages, prev.messages)) {
          next.messages = remoteMessages;
        }

        const visibleMemberIds = visibleMemberIdSet(next.members);
        const trainerHydrateOk = Boolean(hydratedTrainer) && !trainerHydrateFailed;

        if (trustRemotePrograms) {
          const mergedProgs = remotePrograms ?? [];
          if (isMemberLikeSession && (hydratedMember !== null || mergedProgs.length > 0)) {
            const memberIds = memberIdsForSessionEmail(next.members, sessionEmail);
            next.programs = mergeMemberProgramsWithLocalEphemeral(
              mergedProgs,
              prevStripped.programs,
              memberIds,
              prevStripped.workoutMode?.programId,
            );
          } else if (isTrainerSession && trainerHydrateOk) {
            next.programs = mergedProgs;
          } else if (mergedProgs.length > 0 || shouldAdoptRemote(mergedProgs, prev.programs)) {
            next.programs = mergeRemoteProgramsWithLocal(mergedProgs, prev.programs);
          }
        } else if (shouldAdoptRemote(remotePrograms, prev.programs)) {
          next.programs = mergeRemoteProgramsWithLocal(remotePrograms!, prev.programs);
        }

        if (trustRemoteLogs) {
          const mergedLogs = remoteLogs ?? [];
          if (isMemberLikeSession && (hydratedMember !== null || mergedLogs.length > 0)) {
            const memberIds = memberIdsForSessionEmail(next.members, sessionEmail);
            next.logs = mergeRemoteWorkoutLogsWithLocalOptimistic(
              filterLogsForMembers(mergedLogs, memberIds),
              [],
              next.members,
            );
          } else if (isTrainerSession && trainerHydrateOk) {
            next.logs = mergeRemoteWorkoutLogsWithLocalOptimistic(mergedLogs, prev.logs, next.members);
          } else if (mergedLogs.length > 0 || shouldAdoptRemote(mergedLogs, prev.logs)) {
            next.logs = mergeRemoteWorkoutLogsWithLocalOptimistic(mergedLogs, prev.logs, [...next.members, ...prev.members]);
          }
        } else if (shouldAdoptRemote(remoteLogs, prev.logs)) {
          next.logs = mergeRemoteWorkoutLogsWithLocalOptimistic(remoteLogs!, prev.logs, [...next.members, ...prev.members]);
        }

        if (shouldAdoptNonEmptyRemoteOnly(remoteExercises)) {
          next.exercises = remoteExercises;
        }

        if (isMemberLikeSession && sessionEmail) {
          const allowedMemberIds = memberIdsForSessionEmail(next.members, sessionEmail);
          allowedMemberIds.add(sessionEmail);
          const linkedMemberId = prevStripped.currentUser?.memberId?.trim();
          if (linkedMemberId) allowedMemberIds.add(linkedMemberId);
          next.programs = next.programs.filter((program) => allowedMemberIds.has(program.memberId.trim()));
          next.logs = next.logs.filter((log) => allowedMemberIds.has(log.memberId.trim()));
          next.messages = next.messages.filter((message) => allowedMemberIds.has(message.memberId.trim()));
          next.members = filterMembersForSessionEmail(next.members, sessionEmail);
          if (!next.members.length && prevStripped.currentUser?.role === "member") {
            const withFallback = ensureMemberRecordForUser(
              { ...next, members: prevStripped.members },
              prevStripped.currentUser,
              prevStripped.currentUser.memberId ?? prevStripped.memberViewId,
            );
            next.members = filterMembersForSessionEmail(withFallback.members, sessionEmail);
          }
          if (next.members.length === 1) {
            next.memberViewId = next.members[0]!.id;
            next.selectedMemberId = next.members[0]!.id;
          } else if (next.members.length > 1 && prevStripped.currentUser?.role === "member") {
            const resolvedViewId = resolveMemberViewIdForUser({
              role: "member",
              memberId: prevStripped.currentUser.memberId,
              email: sessionEmail,
              members: next.members,
              programs: next.programs,
              fallbackId: prevStripped.memberViewId || prevStripped.currentUser.memberId || `auth-${prevStripped.currentUser.id}`,
            });
            next.memberViewId = resolvedViewId;
            next.selectedMemberId = resolvedViewId;
          }
        }

        if (prevStripped.currentUser?.role === "member") {
          const normalizedCurrentEmail = prevStripped.currentUser.email.trim().toLowerCase();
          const hydratedMember =
            next.members.find((member) => member.id === next.memberViewId) ??
            next.members.find((member) => member.id === next.selectedMemberId) ??
            next.members.find((member) => member.email.trim().toLowerCase() === normalizedCurrentEmail) ??
            null;
          const hydratedName = hydratedMember?.name.trim() ?? "";
          if (hydratedName && hydratedName !== prevStripped.currentUser.name) {
            next.currentUser = {
              ...prevStripped.currentUser,
              name: hydratedName,
            };
          }
        }

        next.programs = normalizeProgramsLegacyCooldownNames(next.programs);
        const merged = syncExercisesWithPrograms(stripDemoSeedCatalog(next));
        stateAfterHydrate = merged;
        return merged;
      });

      if (!cancelled && isMemberLikeSession && sessionEmail && stateAfterHydrate && typeof window !== "undefined") {
        const pushKey = `motus.memberCatalogPush:${sessionUser?.id ?? sessionEmail}`;
        if (!window.sessionStorage.getItem(pushKey)) {
          window.sessionStorage.setItem(pushKey, "1");
          void (async () => {
            const pushResult = await syncMemberLocalCatalogToSupabase(stateAfterHydrate!);
            if (pushResult.programsPushed > 0 || pushResult.logsPushed > 0) {
              console.info(
                `Sky-synk: lastet opp ${pushResult.programsPushed} program og ${pushResult.logsPushed} økter fra denne enheten.`,
              );
              if (!cancelled) await hydrateRemoteData();
            } else if (pushResult.failures.length) {
              console.warn("Sky-synk feilet for noe lokalt innhold:", pushResult.failures.slice(0, 3).join(" | "));
            }
          })();
        }
      }
    }

    remoteHydrateRef.current = async () => {
      await hydrateRemoteData();
    };

    registerMessagesPersistedListener(async () => {
      if (cancelled) return;
      const remoteMessages = await fetchMessagesFromSupabase();
      if (!remoteMessages?.length) return;
      setAppState((prev) => ({
        ...prev,
        messages: mergeRemoteMessagesWithLocalOptimistic(
          remoteMessages,
          prev.messages,
          prev.members,
          Date.now(),
        ),
      }));
    });

    void hydrateRemoteData();
    const interval = window.setInterval(() => {
      void hydrateRemoteData();
    }, 8000);

    const onVisibility = () => {
      if (document.visibilityState === "visible") void hydrateRemoteData();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      remoteHydrateRef.current = null;
      registerMessagesPersistedListener(null);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  useEffect(() => {
    if (!isRecoveryMode) return;
    let cancelled = false;

    async function bootstrapRecoveryAuth() {
      setRecoverySessionReady(false);
      const bootstrapParams = {
        recoveryInviteFlow,
        tokenHash: recoveryTokenHash,
        accessToken: recoveryAccessToken,
        refreshToken: recoveryRefreshToken,
        authCode: recoveryAuthCode,
      };
      persistAuthBootstrapParams(bootstrapParams);

      const result = await establishSessionFromAuthBootstrap(bootstrapParams);
      if (cancelled) return;

      stripSensitiveSupabaseAuthFromBrowserUrl();

      if (!result.ok) {
        setRecoverySessionReady(false);
        setRecoveryError(
          recoveryInviteFlow ? `Invitasjonslenke feilet: ${result.message}` : `Recovery-lenke feilet: ${result.message}`,
        );
        return;
      }
      setRecoveryError(null);
      setRecoverySessionReady(true);
      setRecoveryInfo(
        recoveryInviteFlow
          ? "Invitasjon verifisert. Velg et passord for kontoen din."
          : "Recovery-lenke verifisert. Du kan sette nytt passord.",
      );
    }

    void bootstrapRecoveryAuth();
    return () => {
      cancelled = true;
    };
  }, [isRecoveryMode, recoveryInviteFlow, recoveryTokenHash, recoveryAccessToken, recoveryRefreshToken, recoveryAuthCode]);

  useEffect(() => {
    if (!isSupabaseConfigured || isRecoveryMode) return;
    let cancelled = false;

    async function hydrateSession() {
      if (typeof window !== "undefined" && supabaseClient) {
        const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const query = new URLSearchParams(window.location.search);
        const type = hash.get("type") ?? query.get("type");
        const recoveryFlag = hash.get("recovery") ?? query.get("recovery");
        const inviteFlag = hash.get("invite") ?? query.get("invite");
        const accessToken = hash.get("access_token") ?? query.get("access_token");
        const refreshToken = hash.get("refresh_token") ?? query.get("refresh_token");
        const implicitSession =
          Boolean(accessToken && refreshToken) &&
          type !== "recovery" &&
          type !== "invite" &&
          type !== "signup" &&
          recoveryFlag !== "1" &&
          inviteFlag !== "1";
        if (implicitSession) {
          const result = await establishRecoverySessionFromTokens({
            accessToken: accessToken as string,
            refreshToken: refreshToken as string,
          });
          stripSensitiveSupabaseAuthFromBrowserUrl();
          if (!result.ok) {
            console.warn("Implicit URL auth session failed:", result.message);
          }
        }
      }

      const user = await getSupabaseSessionUser();
      if (cancelled) return;
      if (!user) {
        setIsLocalDemoSession(false);
        setAppState((prev) => ({ ...prev, currentUser: null, role: "trainer" }));
        setIsAuthSessionLoading(false);
        return;
      }
      setIsLocalDemoSession(false);
      setAppState((prev) => {
        const baseState = applyMemberSessionBaseState(prev, user);
        const resolvedSelectedMemberId =
          user.role === "member"
            ? resolveMemberViewIdForUser({
                role: user.role,
                memberId: user.memberId,
                email: user.email,
                members: baseState.members,
                programs: baseState.programs,
                fallbackId: user.memberId ?? (baseState.selectedMemberId || `auth-${user.id}`),
              })
            : user.memberId ?? baseState.selectedMemberId;
        const resolvedMemberViewId = resolveMemberViewIdForUser({
          role: user.role,
          memberId: user.memberId,
          email: user.email,
          members: baseState.members,
          programs: baseState.programs,
          fallbackId: user.memberId ?? (baseState.memberViewId || `auth-${user.id}`),
        });
        return {
          ...baseState,
          currentUser: user,
          role: user.role,
          selectedMemberId: resolvedSelectedMemberId,
          memberViewId: resolvedMemberViewId,
        };
      });
      setIsAuthSessionLoading(false);
    }

    void hydrateSession();
    const {
      data: { subscription },
    } = supabaseClient.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      if (!session?.user) {
        setIsLocalDemoSession(false);
        setAppState((prev) => ({ ...prev, currentUser: null, role: "trainer" }));
        setIsAuthSessionLoading(false);
        return;
      }
      const user = mapSupabaseUserToAuthUser({
        id: session.user.id,
        email: session.user.email,
        user_metadata: session.user.user_metadata as Record<string, unknown> | undefined,
        app_metadata: session.user.app_metadata as Record<string, unknown> | undefined,
      });
      setAppState((prev) => {
        const baseState = applyMemberSessionBaseState(prev, user);
        const resolvedSelectedMemberId =
          user.role === "member"
            ? resolveMemberViewIdForUser({
                role: user.role,
                memberId: user.memberId,
                email: user.email,
                members: baseState.members,
                programs: baseState.programs,
                fallbackId: user.memberId ?? (baseState.selectedMemberId || `auth-${user.id}`),
              })
            : user.memberId ?? baseState.selectedMemberId;
        const resolvedMemberViewId = resolveMemberViewIdForUser({
          role: user.role,
          memberId: user.memberId,
          email: user.email,
          members: baseState.members,
          programs: baseState.programs,
          fallbackId: user.memberId ?? (baseState.memberViewId || `auth-${user.id}`),
        });
        return {
          ...baseState,
          currentUser: user,
          role: user.role,
          selectedMemberId: resolvedSelectedMemberId,
          memberViewId: resolvedMemberViewId,
        };
      });
      setIsAuthSessionLoading(false);
    });
    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [isRecoveryMode]);

  useEffect(() => {
    if (!appState.members.length) return;
    const selectedExists = appState.members.some((member) => member.id === appState.selectedMemberId);
    const viewedExists = appState.members.some((member) => member.id === appState.memberViewId);
    if (selectedExists && viewedExists) return;
    setAppState((prev) => {
      const fallbackId = prev.members[0]?.id ?? "";
      const resolveReplacementId = (missingId: string): string => {
        if (!missingId) return fallbackId;
        const previousMember = prev.members.find((member) => member.id === missingId) ?? null;
        if (!previousMember) return fallbackId;
        const previousEmail = previousMember.email.trim().toLowerCase();
        const byEmail =
          previousEmail
            ? prev.members.find((member) => member.email.trim().toLowerCase() === previousEmail)
            : null;
        if (byEmail?.id) return byEmail.id;
        return fallbackId;
      };
      const selectedStillExists = prev.members.some((member) => member.id === prev.selectedMemberId);
      const viewedStillExists = prev.members.some((member) => member.id === prev.memberViewId);
      return {
        ...prev,
        selectedMemberId: selectedStillExists ? prev.selectedMemberId : resolveReplacementId(prev.selectedMemberId),
        memberViewId: viewedStillExists ? prev.memberViewId : resolveReplacementId(prev.memberViewId),
      };
    });
  }, [appState.members, appState.selectedMemberId, appState.memberViewId]);

  useEffect(() => {
    if (!appState.currentUser) return;
    if (appState.currentUser.role !== "member") return;
    const resolvedMemberId = resolveMemberViewIdForUser({
      role: appState.currentUser.role,
      memberId: appState.currentUser.memberId,
      email: appState.currentUser.email,
      members: appState.members,
      programs: appState.programs,
      fallbackId: appState.memberViewId,
    });
    if (!resolvedMemberId) return;
    if (resolvedMemberId === appState.memberViewId && resolvedMemberId === appState.selectedMemberId) return;
    setAppState((prev) => ({
      ...prev,
      memberViewId: resolvedMemberId,
      selectedMemberId: resolvedMemberId,
    }));
  }, [
    appState.currentUser,
    appState.members,
    appState.programs,
    appState.memberViewId,
    appState.selectedMemberId,
  ]);

  function patchState(patch: Partial<AppState> | ((prev: AppState) => AppState)) {
    if (typeof patch === "function") {
      setAppState((prev) => patch(prev));
      return;
    }
    setAppState((prev) => ({ ...prev, ...patch }));
  }

  async function handleLogin() {
    const normalizedEmail = loginEmail.trim().toLowerCase();
    if (!normalizedEmail) {
      setLoginError("Skriv inn e-post for å logge inn.");
      return;
    }
    if (!loginPassword.trim()) {
      setLoginError("Skriv inn passord for å logge inn.");
      return;
    }
    const matchedDemoUser = demoUsers.find((user) => user.email.toLowerCase() === normalizedEmail && user.password === loginPassword);

    if (isSupabaseConfigured) {
      const supabaseResult = await signInWithSupabase(normalizedEmail, loginPassword);
      if (supabaseResult.ok) {
        const supabaseUser = supabaseResult.user;
        if (supabaseUser.role === "member" && (await checkMemberAccessBlocked(normalizedEmail))) {
          await blockArchivedMemberAccess(MEMBER_ARCHIVED_APP_MESSAGE, normalizedEmail);
          return;
        }
        setAppState((prev) => {
          const baseState = applyMemberSessionBaseState(prev, supabaseUser);
          const resolvedSelectedMemberId =
            supabaseUser.role === "member"
              ? resolveMemberViewIdForUser({
                  role: supabaseUser.role,
                  memberId: supabaseUser.memberId,
                  email: supabaseUser.email,
                  members: baseState.members,
                  programs: baseState.programs,
                  fallbackId: supabaseUser.memberId ?? (baseState.selectedMemberId || `auth-${supabaseUser.id}`),
                })
              : supabaseUser.memberId ?? baseState.selectedMemberId;
          const resolvedMemberViewId = resolveMemberViewIdForUser({
            role: supabaseUser.role,
            memberId: supabaseUser.memberId,
            email: supabaseUser.email,
            members: baseState.members,
            programs: baseState.programs,
            fallbackId: supabaseUser.memberId ?? (baseState.memberViewId || `auth-${supabaseUser.id}`),
          });
          return {
            ...baseState,
            currentUser: supabaseUser,
            role: supabaseUser.role,
            selectedMemberId: resolvedSelectedMemberId,
            memberViewId: resolvedMemberViewId,
          };
        });
        if (supabaseUser.role === "member") {
          const candidateMemberId =
            toLinkableMemberId(supabaseUser.memberId) ??
            toLinkableMemberId(resolvedMemberViewId) ??
            toLinkableMemberId(resolvedSelectedMemberId);
          await ensureMemberAuthLink(supabaseUser.email, candidateMemberId);
          const refreshedUser = await refreshSupabaseSessionUser();
          if (refreshedUser) {
            setAppState((prev) => ({
              ...prev,
              currentUser: refreshedUser,
              role: refreshedUser.role,
            }));
          }
        }
        setTrainerTab("dashboard");
        setMemberTab("overview");
        setLoginError(null);
        setIsLocalDemoSession(false);
        return;
      }

      setLoginError(`Innlogging feilet: ${supabaseResult.message}`);
      return;
    }

    if (!matchedDemoUser) {
      setLoginError("Feil e-post eller passord.");
      return;
    }
    const { password: _password, ...safeUser } = matchedDemoUser;
    setAppState((prev) => ({
      ...prev,
      currentUser: safeUser,
      role: safeUser.role,
      selectedMemberId: safeUser.memberId ?? prev.selectedMemberId,
      memberViewId: safeUser.memberId ?? prev.memberViewId,
    }));
    setTrainerTab("dashboard");
    setMemberTab("overview");
    setLoginError(null);
    setIsLocalDemoSession(true);
  }

  async function completePasswordRecovery() {
    const password = recoveryPassword.trim();
    if (password.length < 6) {
      setRecoveryError("Passord ma vaere minst 6 tegn.");
      return;
    }
    if (password !== recoveryPasswordConfirm.trim()) {
      setRecoveryError("Passordene matcher ikke.");
      return;
    }

    const sessionResult = await ensureAuthSessionForPasswordUpdate({
      recoveryInviteFlow,
      recoveryTokenHash,
      recoveryAccessToken,
      recoveryRefreshToken,
      recoveryAuthCode,
    });
    if (!sessionResult.ok) {
      setRecoverySessionReady(false);
      setRecoveryError(`Kunne ikke sette nytt passord: ${sessionResult.message}`);
      return;
    }
    setRecoverySessionReady(true);

    const result = await updateSupabasePassword(password);
    if (!result.ok) {
      setRecoveryError(`Kunne ikke sette nytt passord: ${result.message}`);
      return;
    }

    setRecoveryError(null);
    const wasInviteFlow = recoveryInviteFlow;
    if (wasInviteFlow) {
      await signOutSupabase();
      setAppState((prev) => ({ ...prev, currentUser: null, role: "trainer" }));
      setRecoveryInviteFlow(false);
      setRecoveryInfo("Passord er satt. Logg inn med e-post og passord.");
    } else {
      setRecoveryInfo("Passord oppdatert. Logg inn med nytt passord.");
    }
    setIsRecoveryMode(false);
    setIsAuthSessionLoading(false);
    setRecoveryPassword("");
    setRecoveryPasswordConfirm("");
    setRecoveryTokenHash(null);
    setRecoveryAccessToken(null);
    setRecoveryRefreshToken(null);
    setRecoveryAuthCode(null);
    setRecoverySessionReady(false);
    clearPersistedAuthBootstrapParams();
    if (typeof window !== "undefined") {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }

  async function sendPasswordRecoveryEmail() {
    if (passwordRecoveryCooldownSeconds > 0) return;
    setPasswordRecoveryError(null);
    setPasswordRecoveryInfo(null);

    const result = await requestPasswordRecovery(loginEmail);
    if (!result.ok) {
      setPasswordRecoveryError(result.message);
      const normalized = result.message.toLowerCase();
      if (normalized.includes("for mange forespørsler") || normalized.includes("for mange foresporsler")) {
        setPasswordRecoveryCooldownSeconds(60);
      }
      return;
    }

    setPasswordRecoveryInfo(result.message);
    setPasswordRecoveryCooldownSeconds(60);
  }

  async function sendEmailOtpCode() {
    setOtpError(null);
    setOtpInfo(null);
    const result = await requestEmailOtpSignIn(loginEmail);
    if (!result.ok) {
      setOtpError(result.message);
      return;
    }
    setOtpInfo(result.message);
  }

  async function loginWithEmailOtpCode() {
    setOtpError(null);
    setOtpInfo(null);
    const result = await verifyEmailOtpSignIn(loginEmail, otpCode);
    if (!result.ok) {
      setOtpError(result.message);
      return;
    }
    const user = result.user;
    if (user.role === "member") {
      const email = user.email.trim().toLowerCase();
      const hydratedMember = await fetchHydratedMemberData();
      const archivedMessage = hydratedMemberAccessDenied(hydratedMember);
      if (archivedMessage || (await checkMemberAccessBlocked(email))) {
        await blockArchivedMemberAccess(archivedMessage ?? MEMBER_ARCHIVED_APP_MESSAGE, email);
        return;
      }
    }
    const baseState = applyMemberSessionBaseState(appState, user);
    const resolvedSelectedMemberId =
      user.role === "member"
        ? resolveMemberViewIdForUser({
            role: user.role,
            memberId: user.memberId,
            email: user.email,
            members: baseState.members,
            programs: baseState.programs,
            fallbackId: user.memberId ?? (baseState.selectedMemberId || `auth-${user.id}`),
          })
        : user.memberId ?? baseState.selectedMemberId;
    const resolvedMemberViewId = resolveMemberViewIdForUser({
      role: user.role,
      memberId: user.memberId,
      email: user.email,
      members: baseState.members,
      programs: baseState.programs,
      fallbackId: user.memberId ?? (baseState.memberViewId || `auth-${user.id}`),
    });
    if (user.role === "member") {
      const candidateMemberId =
        toLinkableMemberId(user.memberId) ??
        toLinkableMemberId(resolvedMemberViewId) ??
        toLinkableMemberId(resolvedSelectedMemberId);
      await ensureMemberAuthLink(user.email, candidateMemberId);
      const refreshedUser = await refreshSupabaseSessionUser();
      if (refreshedUser) {
        user.memberId = refreshedUser.memberId;
      }
    }
    setAppState((prev) => {
      const nextBase = applyMemberSessionBaseState(prev, user);
      return {
        ...nextBase,
        currentUser: user,
        role: user.role,
        selectedMemberId: resolvedSelectedMemberId,
        memberViewId: resolvedMemberViewId,
      };
    });
    setTrainerTab("dashboard");
    setMemberTab("overview");
    setLoginError(null);
    setOtpCode("");
    setOtpInfo("Innlogging med engangskode fullført.");
    setIsLocalDemoSession(false);
  }

  function handleQuickLogin(email: string) {
    if (!isDemoMode) return;
    setLoginEmail(email);
    setLoginPassword("123456");
    const matchedUser = demoUsers.find((user) => user.email.toLowerCase() === email.toLowerCase());
    if (!matchedUser) return;
    const { password: _password, ...safeUser } = matchedUser;
    setAppState((prev) => ({
      ...prev,
      currentUser: safeUser,
      role: safeUser.role,
      selectedMemberId: safeUser.memberId ?? prev.selectedMemberId,
      memberViewId: safeUser.memberId ?? prev.memberViewId,
    }));
    setTrainerTab("dashboard");
    setMemberTab("overview");
    setLoginError(null);
    setIsLocalDemoSession(true);
  }

  async function handleLogout() {
    if (isSupabaseConfigured) {
      await signOutSupabase();
    }
    clearSessionOwnerEmail();
    if (typeof window !== "undefined") {
      for (let i = window.sessionStorage.length - 1; i >= 0; i -= 1) {
        const key = window.sessionStorage.key(i);
        if (key?.startsWith("motus.memberCatalogPush:")) {
          window.sessionStorage.removeItem(key);
        }
      }
    }
    setAppState((prev) => ({ ...prev, currentUser: null, role: "trainer" }));
    setIsAuthSessionLoading(false);
    setLoginEmail("");
    setLoginPassword("");
    setLoginError(null);
    setIsLocalDemoSession(false);
    setRemoteTrainerPeriodPlansByMemberId({});
    setRemoteMemberPeriodPlanRows([]);
  }

  function resetAllData() {
    setAppState(getDefaultState());
    setTrainerTab("dashboard");
    setMemberTab("overview");
    setLoginEmail("");
    setLoginPassword("");
    setLoginError(null);
    setIsLocalDemoSession(false);
    setRemoteTrainerPeriodPlansByMemberId({});
    setRemoteMemberPeriodPlanRows([]);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }

  function clearLocalChatCache() {
    let cleared = 0;
    setAppState((prev) => {
      const nextMessages = prev.messages.filter((message) => {
        const isLocalOptimistic = message.id.startsWith("msg") || message.id.startsWith("local-");
        if (isLocalOptimistic) cleared += 1;
        return !isLocalOptimistic;
      });
      return { ...prev, messages: nextMessages };
    });
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    return cleared;
  }

  async function addMember(input: CreateMemberInput): Promise<CreateMemberResult> {
    if (!isSupabaseConfigured) {
      let createdMember: Member | undefined;
      setAppState((prev) => {
        const next = localAppRepository.addMember(prev, input);
        createdMember = next.members[next.members.length - 1];
        return next;
      });
      return createdMember
        ? { ok: true, member: createdMember }
        : { ok: false, message: "Kunne ikke opprette kunde lokalt." };
    }

    let optimisticMember: Member | null = null;
    let previousSelectedMemberId = "";
    setAppState((prev) => {
      const created = createMember(prev, input);
      const sessionOwnerHint =
        prev.currentUser?.role === "trainer" ? String(prev.currentUser.id ?? "").trim() : "";
      optimisticMember = {
        ...created,
        ownerUserId:
          sessionOwnerHint &&
          (created.customerType === "PT-kunde" || created.membershipType === "Premium")
            ? sessionOwnerHint
            : created.ownerUserId,
      };
      previousSelectedMemberId = prev.selectedMemberId;
      return {
        ...prev,
        members: [...prev.members, optimisticMember],
        selectedMemberId: optimisticMember.id,
      };
    });

    if (!optimisticMember) {
      return { ok: false, message: "Kunne ikke opprette kunde." };
    }

    const pendingMember = optimisticMember;
    const result = await createTrainerMemberViaEdgeFunction(pendingMember, input);
    if (!result.ok) {
      setAppState((prev) => ({
        ...prev,
        members: prev.members.filter((member) => member.id !== pendingMember.id),
        selectedMemberId:
          prev.selectedMemberId === pendingMember.id ? previousSelectedMemberId : prev.selectedMemberId,
      }));
      return result;
    }

    pinTrainerMember(result.member);

    setAppState((prev) => ({
      ...prev,
      members:
        mergeMembersById(
          prev.members.map((member) => (member.id === pendingMember.id ? result.member : member)),
          [result.member],
        ) ?? prev.members,
      selectedMemberId: result.member.id,
    }));

    return result;
  }

  function deactivateMember(memberId: string) {
    setAppState((prev) => repository.deactivateMember(prev, memberId));
  }

  function deleteMember(memberId: string) {
    setAppState((prev) => repository.deleteMember(prev, memberId));
  }

  function updateMember(input: UpdateMemberInput) {
    setAppState((prev) => {
      const nextState = repository.updateMember(prev, input);
      const currentUser = prev.currentUser;
      if (!currentUser || currentUser.role !== "member") return nextState;
      const updatedMember = nextState.members.find((member) => member.id === input.memberId);
      if (!updatedMember) return nextState;
      const normalizedCurrentEmail = currentUser.email.trim().toLowerCase();
      const normalizedUpdatedEmail = updatedMember.email.trim().toLowerCase();
      const isCurrentMember =
        updatedMember.id === prev.memberViewId ||
        updatedMember.id === prev.selectedMemberId ||
        (normalizedCurrentEmail && normalizedUpdatedEmail === normalizedCurrentEmail);
      if (!isCurrentMember) return nextState;
      const nextName = updatedMember.name.trim();
      if (!nextName || nextName === currentUser.name) return nextState;
      return {
        ...nextState,
        currentUser: {
          ...currentUser,
          name: nextName,
        },
      };
    });
  }

  function markMemberInvited(memberId: string, invitedAtIso?: string) {
    setAppState((prev) => repository.markMemberInvited(prev, memberId, invitedAtIso));
  }

  function saveProgramForMember(input: SaveProgramInput) {
    if (!input.title.trim() || !input.memberId) return;

    setAppState((prev) => syncExercisesWithProgramsAfterSave(repository.saveProgram(prev, input), input));
  }

  function deleteProgramById(programId: string, context?: { memberIds?: string[]; targetEmail?: string; targetName?: string }) {
    setAppState((prev) => repository.deleteProgram(prev, programId, context));
  }

  function updateProgramMemberLibraryStatus(programId: string, status: MemberProgramLibraryStatus | undefined) {
    if (!programId.trim()) return;
    setAppState((prev) => repository.updateProgramMemberLibraryStatus(prev, programId, status));
  }

  function sendTrainerMessage(memberId: string, text: string) {
    if (!text.trim()) return;
    setAppState((prev) => repository.appendTrainerMessage(prev, memberId, text));
  }

  function saveExercise(input: SaveExerciseInput) {
    setAppState((prev) => repository.saveExercise(prev, input));
  }

  function deleteExercise(exerciseId: string) {
    if (!exerciseId.trim()) return;
    setAppState((prev) => repository.deleteExercise(prev, exerciseId));
  }

  function startWorkoutMode(programId: string, options?: StartWorkoutModeOptions) {
    setAppState((prev) => {
      const memberId = prev.workoutMode?.memberId?.trim() || prev.memberViewId?.trim() || prev.currentUser?.memberId?.trim() || "";
      if (memberId) clearPausedWorkoutForProgram(memberId, programId);
      return repository.startWorkoutMode(prev, programId, options);
    });
  }

  function startCustomWorkout(input: StartCustomWorkoutInput, options?: StartWorkoutModeOptions) {
    setAppState((prev) => repository.startCustomWorkout(prev, input, options));
  }

  function updateWorkoutExerciseResult(
    exerciseId: string,
    field: "performedWeight" | "performedReps" | "performedDurationMinutes" | "performedSpeed" | "performedIncline" | "completed",
    value: string | boolean,
  ) {
    setAppState((prev) => repository.updateWorkoutResult(prev, { exerciseId, field, value }));
  }

  function appendWorkoutSetForProgramExercise(programExerciseId: string) {
    if (!programExerciseId.trim()) return;
    setAppState((prev) => repository.appendWorkoutSetForProgramExercise(prev, programExerciseId));
  }

  function replaceWorkoutExerciseGroup(input: ReplaceWorkoutExerciseGroupInput) {
    setAppState((prev) => repository.replaceWorkoutExerciseGroup(prev, input));
  }

  function deferWorkoutExerciseGroup(programExerciseId: string) {
    if (!programExerciseId.trim()) return;
    setAppState((prev) => repository.deferWorkoutExerciseGroup(prev, programExerciseId));
  }

  function removeWorkoutLogResult(input: RemoveWorkoutLogResultInput) {
    setAppState((prev) => repository.removeWorkoutLogResult(prev, input));
  }

  function setWorkoutLogResults(input: SetWorkoutLogResultsInput) {
    setAppState((prev) => repository.setWorkoutLogResults(prev, input));
  }

  function updateWorkoutLogTrainerComment(input: {
    logId: string;
    trainerComment: string;
    trainerCommentUpdatedAt?: string;
    trainerCommentAuthorName?: string;
  }) {
    setAppState((prev) => repository.updateWorkoutLogTrainerComment(prev, input));
  }

  function updateWorkoutModeNote(note: string) {
    setAppState((prev) => repository.updateWorkoutNote(prev, note));
  }

  function updateWorkoutExerciseNote(programExerciseId: string, note: string) {
    if (!programExerciseId.trim()) return;
    setAppState((prev) => repository.updateWorkoutExerciseNote(prev, programExerciseId, note));
  }

  function cancelWorkoutMode() {
    setAppState((prev) => {
      const programId = prev.workoutMode?.programId ?? "";
      const memberId =
        prev.workoutMode?.memberId?.trim() || prev.memberViewId?.trim() || prev.currentUser?.memberId?.trim() || "";
      if (programId) clearPausedWorkoutForProgram(memberId, programId);
      return repository.cancelWorkoutMode(prev);
    });
  }

  function dismissWorkoutMode() {
    setAppState((prev) => dismissWorkoutModeInState(prev));
  }

  function resumePausedWorkout(draftId: string, memberIdHint?: string) {
    if (!draftId.trim()) return;
    setAppState((prev) => {
      const memberId =
        memberIdHint?.trim() ||
        prev.memberViewId?.trim() ||
        prev.currentUser?.memberId?.trim() ||
        "";
      return resumePausedWorkoutInState(prev, draftId, memberId);
    });
  }

  function discardPausedWorkoutDraft(memberId: string, draftId: string) {
    if (!memberId.trim() || !draftId.trim()) return;
    const draft = getPausedWorkoutById(memberId, draftId);
    discardPausedWorkoutDraftForMember(memberId, draftId);
    if (!draft) return;
    setAppState((prev) => {
      if (prev.workoutMode?.programId === draft.programId) {
        const program = prev.programs.find((item) => item.id === draft.programId);
        const programs = program?.ephemeral ? prev.programs.filter((item) => item.id !== program.id) : prev.programs;
        return { ...prev, programs, workoutMode: null };
      }
      return prev;
    });
  }

  function finishWorkoutMode(input?: FinishWorkoutInput) {
    setAppState((prev) => {
      const programId = prev.workoutMode?.programId ?? "";
      const memberIds = [
        prev.workoutMode?.memberId,
        prev.memberViewId,
        prev.currentUser?.memberId,
      ]
        .map((id) => id?.trim() ?? "")
        .filter(Boolean);
      const next = repository.finishWorkoutMode(prev, input);
      if (programId) clearPausedWorkoutForProgram(memberIds[0] ?? "", programId);
      return next;
    });
    setMemberTab("progress");
  }

  function logGroupWorkout(input: LogGroupWorkoutInput) {
    setAppState((prev) => repository.logGroupWorkout(prev, input));
    if (input.keepCurrentTab !== true) {
      setMemberTab("progress");
    }
  }

  function logIntervalWorkout(input: LogIntervalWorkoutInput) {
    setAppState((prev) => repository.logIntervalWorkout(prev, input));
    if (input.keepCurrentTab !== true) {
      setMemberTab("progress");
    }
  }

  function removeGroupWorkoutLog(input: RemoveGroupWorkoutLogInput) {
    setAppState((prev) => repository.removeGroupWorkoutLog(prev, input));
  }

  function logCompletedPlanEntry(input: LogCompletedPlanEntryInput) {
    setAppState((prev) => repository.logCompletedPlanEntry(prev, input));
    if (input.keepCurrentTab !== true) {
      setMemberTab("progress");
    }
  }

  function removeCompletedPlanEntryLog(input: RemoveCompletedPlanEntryLogInput) {
    setAppState((prev) => repository.removeCompletedPlanEntryLog(prev, input));
  }

  function sendMemberMessage(memberId: string, text: string) {
    if (!text.trim()) return;
    setAppState((prev) => repository.appendMemberMessage(prev, memberId, text));
  }

  function dismissWorkoutCelebration() {
    setAppState((prev) => ({ ...prev, workoutCelebration: null }));
  }

  async function inviteMember(email: string, memberId: string): Promise<InviteMemberResult> {
    if (!isSupabaseConfigured) {
      return { ok: false, message: "Invitasjon er ikke tilgjengelig akkurat nå." };
    }
    return inviteMemberByEmail(email, memberId);
  }

  async function refreshTrainerSessionData(ownerUserId: string) {
    const hydratedTrainer = ownerUserId ? await fetchHydratedTrainerData(ownerUserId) : null;
    const directTrainerMembers = await fetchMembersFromSupabase();
    const remoteMembers = hydratedTrainer
      ? mergeMembersById(hydratedTrainer.members, directTrainerMembers)
      : directTrainerMembers;
    const remoteMessages = hydratedTrainer?.messages ?? (await fetchMessagesFromSupabase());
    const remotePrograms = hydratedTrainer?.programs ?? (await fetchProgramsFromSupabase());
    const remoteLogs = hydratedTrainer?.logs ?? (await fetchLogsFromSupabase());

    if (remoteMembers) {
      setAppState((prev) => ({
        ...prev,
        members: mergeTrainerMembersWithLocalAndPinned(
          remoteMembers,
          prev.members,
          readPinnedTrainerMembers(),
        ),
        ...(remoteMessages ? { messages: remoteMessages } : {}),
        ...(remotePrograms ? { programs: mergeRemoteProgramsWithLocal(remotePrograms, prev.programs) } : {}),
        ...(remoteLogs ? { logs: remoteLogs } : {}),
        ...(hydratedTrainer?.periodPlansByMemberId
          ? { remoteTrainerPeriodPlansByMemberId: hydratedTrainer.periodPlansByMemberId }
          : {}),
      }));
    }
  }

  async function restoreMemberByEmail(
    email: string,
    options?: RestoreMemberOptions,
  ): Promise<{ ok: boolean; message: string }> {
    if (!isSupabaseConfigured) {
      return { ok: false, message: "Gjenoppretting er ikke tilgjengelig akkurat nå." };
    }
    const {
      data: { session },
    } = supabaseClient ? await supabaseClient.auth.getSession() : { data: { session: null } };
    const sessionOwnerUserId = String(session?.user?.id ?? "").trim();
    const normalizedEmail = email.trim().toLowerCase();
    const result = await restoreMemberByEmailFromSupabase(email, {
      ownerUserId: options?.ownerUserId ?? sessionOwnerUserId,
      claimForTrainer: options?.claimForTrainer ?? true,
    });
    if (!result.ok) return result;

    setAppState((prev) => {
      const members = prev.members.map((member) => {
        const sameEmail = member.email.trim().toLowerCase() === normalizedEmail;
        if (!sameEmail) return member;
        return { ...member, isActive: true };
      });
      const restored =
        members.find(
          (member) => member.email.trim().toLowerCase() === normalizedEmail && member.isActive !== false,
        ) ?? null;
      return {
        ...prev,
        members,
        ...(restored
          ? {
              selectedMemberId: restored.id,
            }
          : {}),
      };
    });

    const ownerUserId = String(options?.ownerUserId ?? sessionOwnerUserId).trim();
    if (ownerUserId) await refreshTrainerSessionData(ownerUserId);
    return result;
  }

  async function reassignMemberOwner(input: {
    memberId: string;
    targetOwnerUserId: string;
  }): Promise<{ ok: boolean; message: string }> {
    if (!isSupabaseConfigured) {
      return { ok: false, message: "Overføring er ikke tilgjengelig akkurat nå." };
    }
    const {
      data: { session },
    } = supabaseClient ? await supabaseClient.auth.getSession() : { data: { session: null } };
    const sessionOwnerUserId = String(session?.user?.id ?? "").trim();
    const result = await reassignMemberOwnerFromSupabase(input);
    if (!result.ok) return result;
    if (sessionOwnerUserId) {
      await refreshTrainerSessionData(sessionOwnerUserId);
      const transferredId = input.memberId.trim();
      setAppState((prev) => ({
        ...prev,
        selectedMemberId: prev.selectedMemberId === transferredId ? "" : prev.selectedMemberId,
      }));
    }
    return result;
  }

  async function inviteTrainer(email: string): Promise<InviteTrainerResult> {
    if (!isSupabaseConfigured) {
      return { ok: false, message: "Invitasjon er ikke tilgjengelig akkurat nå." };
    }
    return inviteTrainerByEmail(email);
  }

  async function restoreMissingTestData(): Promise<{ ok: boolean; message: string }> {
    const defaults = getDefaultState();
    let addedMembers = 0;

    setAppState((prev) => {
      const existingMemberIds = new Set(prev.members.map((member) => member.id));
      const existingMemberEmails = new Set(prev.members.map((member) => member.email.trim().toLowerCase()));
      const membersToAdd = defaults.members.filter((member) => {
        const normalizedEmail = member.email.trim().toLowerCase();
        if (existingMemberIds.has(member.id)) return false;
        if (normalizedEmail && existingMemberEmails.has(normalizedEmail)) return false;
        return true;
      });

      addedMembers = membersToAdd.length;
      const nextMembers = [...prev.members, ...membersToAdd];
      const fallbackMemberId = nextMembers[0]?.id ?? "";

      return {
        ...prev,
        members: nextMembers,
        selectedMemberId: prev.selectedMemberId || fallbackMemberId,
        memberViewId: prev.memberViewId || fallbackMemberId,
      };
    });

    const noChanges = addedMembers === 0;
    if (noChanges) {
      return { ok: true, message: "Testmedlemmer var allerede komplette." };
    }
    return {
      ok: true,
      message: `Gjenopprettet ${addedMembers} testmedlem${addedMembers === 1 ? "" : "mer"}.`,
    };
  }

  async function restoreOriginalExerciseBank(): Promise<{ ok: boolean; message: string }> {
    const defaults = getDefaultState();
    setAppState((prev) => ({
      ...prev,
      exercises: defaults.exercises,
    }));
    return {
      ok: true,
      message: `Original øvelsesbank gjenopprettet (${defaults.exercises.length} øvelser).`,
    };
  }

  async function refreshRemoteHydration() {
    await remoteHydrateRef.current?.();
  }

  return {
    appState,
    isAuthSessionLoading,
    loginEmail,
    setLoginEmail,
    loginPassword,
    setLoginPassword,
    loginError,
    isRecoveryMode,
    recoveryInviteFlow,
    recoverySessionReady,
    recoveryPassword,
    setRecoveryPassword,
    recoveryPasswordConfirm,
    setRecoveryPasswordConfirm,
    recoveryError,
    recoveryInfo,
    passwordRecoveryInfo,
    passwordRecoveryError,
    passwordRecoveryCooldownSeconds,
    otpCode,
    setOtpCode,
    otpInfo,
    otpError,
    trainerTab,
    setTrainerTab,
    memberTab,
    setMemberTab,
    patchState,
    handleLogin,
    handleQuickLogin,
    completePasswordRecovery,
    sendPasswordRecoveryEmail,
    sendEmailOtpCode,
    loginWithEmailOtpCode,
    showQuickLogin: isDemoMode,
    isLocalDemoSession,
    handleLogout,
    resetAllData,
    clearLocalChatCache,
    refreshRemoteHydration,
    addMember,
    deactivateMember,
    deleteMember,
    updateMember,
    markMemberInvited,
    saveProgramForMember,
    deleteProgramById,
    updateProgramMemberLibraryStatus,
    sendTrainerMessage,
    saveExercise,
    deleteExercise,
    startWorkoutMode,
    startCustomWorkout,
    updateWorkoutExerciseResult,
    replaceWorkoutExerciseGroup,
    appendWorkoutSetForProgramExercise,
    deferWorkoutExerciseGroup,
    removeWorkoutLogResult,
    setWorkoutLogResults,
    updateWorkoutLogTrainerComment,
    updateWorkoutModeNote,
    updateWorkoutExerciseNote,
    finishWorkoutMode,
    logGroupWorkout,
    logIntervalWorkout,
    logCompletedPlanEntry,
    removeGroupWorkoutLog,
    removeCompletedPlanEntryLog,
    cancelWorkoutMode,
    dismissWorkoutMode,
    resumePausedWorkout,
    discardPausedWorkoutDraft,
    dismissWorkoutCelebration,
    sendMemberMessage,
    inviteMember,
    inviteTrainer,
    restoreMemberByEmail,
    reassignMemberOwner,
    restoreMissingTestData,
    restoreOriginalExerciseBank,
    remoteTrainerPeriodPlansByMemberId,
    remoteMemberPeriodPlanRows,
  };
}
