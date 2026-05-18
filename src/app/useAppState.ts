import { useEffect, useRef, useState } from "react";
import { STORAGE_KEY, demoUsers, getDefaultState } from "./data";
import { loadState, saveState } from "./storage";
import {
  localAppRepository,
  type CreateMemberInput,
  type FinishWorkoutInput,
  type LogCompletedPlanEntryInput,
  type LogGroupWorkoutInput,
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
import { pickBestPersonalGoals } from "./memberProfileGoals";
import { notifyInspirationItemsChanged, saveInspirationItemsToStorage } from "./inspirationStorage";
import { isSupabaseConfigured, supabaseClient } from "../services/supabaseClient";
import {
  fetchExercisesFromSupabase,
  checkMemberAccessBlocked,
  fetchHydratedMemberData,
  fetchHydratedTrainerData,
  fetchLogsFromSupabase,
  fetchMembersFromSupabase,
  fetchMessagesFromSupabase,
  fetchProgramsFromSupabase,
  restoreMemberByEmailFromSupabase,
  supabaseAppRepository,
  type HydratedMemberData,
} from "../services/supabaseRepository";
import { isMemberAppAccessBlocked, MEMBER_ARCHIVED_APP_MESSAGE } from "../services/memberAccessRules";
import {
  ensureMemberAuthLink,
  establishRecoverySessionFromTokens,
  getSupabaseSessionUser,
  inviteMemberByEmail,
  inviteTrainerByEmail,
  refreshSupabaseSessionUser,
  requestEmailOtpSignIn,
  requestPasswordRecovery,
  signInWithSupabase,
  signOutSupabase,
  updateSupabasePassword,
  verifyEmailOtpSignIn,
  verifyInviteToken,
  verifyRecoveryToken,
  type InviteMemberResult,
  type InviteTrainerResult,
} from "../services/supabaseAuth";
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

function syncExercisesWithPrograms(state: AppState): AppState {
  const exercisesById = new Map(state.exercises.map((exercise) => [exercise.id, exercise]));
  const exercisesByName = new Map(state.exercises.map((exercise) => [exercise.name.trim().toLowerCase(), exercise]));
  const appendedExercises: Exercise[] = [];

  state.programs.forEach((program) => {
    program.exercises.forEach((programExercise) => {
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
  });

  let hasProgramNameFix = false;
  const normalizedPrograms = state.programs.map((program) => ({
    ...program,
    exercises: program.exercises.map((programExercise) => {
      const source = exercisesById.get(programExercise.exerciseId.trim());
      if (!source || source.name === programExercise.exerciseName) return programExercise;
      hasProgramNameFix = true;
      return { ...programExercise, exerciseName: source.name };
    }),
  }));

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
  recoveryInfo: string | null;
  stripSensitiveAfterCapture: boolean;
} | null {
  if (typeof window === "undefined" || !isSupabaseConfigured) return null;
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const query = new URLSearchParams(window.location.search);
  const type = hash.get("type") ?? query.get("type");
  const recoveryFlag = hash.get("recovery") ?? query.get("recovery");
  const tokenHash = hash.get("token_hash") ?? query.get("token_hash");
  const accessToken = hash.get("access_token") ?? query.get("access_token");
  const refreshToken = hash.get("refresh_token") ?? query.get("refresh_token");
  const hasSecrets = Boolean(tokenHash || accessToken || refreshToken);
  if (type === "recovery" || recoveryFlag === "1") {
    return {
      isRecoveryMode: true,
      recoveryInviteFlow: false,
      recoveryTokenHash: tokenHash,
      recoveryAccessToken: accessToken,
      recoveryRefreshToken: refreshToken,
      recoveryInfo: "Recovery-lenke registrert. Velg nytt passord.",
      stripSensitiveAfterCapture: hasSecrets,
    };
  }
  if (type === "invite") {
    return {
      isRecoveryMode: true,
      recoveryInviteFlow: true,
      recoveryTokenHash: tokenHash,
      recoveryAccessToken: accessToken,
      recoveryRefreshToken: refreshToken,
      recoveryInfo: "Invitasjon registrert. Velg et passord for kontoen din.",
      stripSensitiveAfterCapture: hasSecrets,
    };
  }
  return null;
}

function stripSensitiveSupabaseAuthFromBrowserUrl(): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  let changed = false;
  for (const key of ["access_token", "refresh_token", "expires_in", "token_type", "provider_token", "token_hash", "type"]) {
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
  const isDemoMode = import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEMO_MODE === "true";
  const repository = isSupabaseConfigured ? supabaseAppRepository : localAppRepository;
  const [appState, setAppState] = useState<AppState>(() => loadState());
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isRecoveryMode, setIsRecoveryMode] = useState(() => INITIAL_SUPABASE_AUTH_FROM_URL?.isRecoveryMode ?? false);
  const [recoveryInviteFlow, setRecoveryInviteFlow] = useState(() => INITIAL_SUPABASE_AUTH_FROM_URL?.recoveryInviteFlow ?? false);
  const [recoveryTokenHash, setRecoveryTokenHash] = useState<string | null>(() => INITIAL_SUPABASE_AUTH_FROM_URL?.recoveryTokenHash ?? null);
  const [recoveryAccessToken, setRecoveryAccessToken] = useState<string | null>(
    () => INITIAL_SUPABASE_AUTH_FROM_URL?.recoveryAccessToken ?? null,
  );
  const [recoveryRefreshToken, setRecoveryRefreshToken] = useState<string | null>(
    () => INITIAL_SUPABASE_AUTH_FROM_URL?.recoveryRefreshToken ?? null,
  );
  const [recoveryPassword, setRecoveryPassword] = useState("");
  const [recoveryPasswordConfirm, setRecoveryPasswordConfirm] = useState("");
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
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

  function ensureMemberRecordForUser(state: AppState, user: AuthUser, preferredMemberId?: string): AppState {
    if (user.role !== "member") return state;
    const normalizedEmail = user.email.trim().toLowerCase();
    const resolvedMemberId = (preferredMemberId || user.memberId || `auth-${user.id}`).trim();
    if (!resolvedMemberId && !normalizedEmail) return state;

    const existingById = resolvedMemberId ? state.members.find((member) => member.id === resolvedMemberId) : null;
    const existingByEmail =
      normalizedEmail ? state.members.find((member) => member.email.trim().toLowerCase() === normalizedEmail) : null;
    const existing = existingById ?? existingByEmail ?? null;
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
    saveState(appState);
  }, [appState]);

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
      const sessionRole = (() => {
        const appRole = sessionUser?.app_metadata?.role;
        if (appRole === "member" || appRole === "trainer") return appRole;
        const userRole = sessionUser?.user_metadata?.role;
        if (userRole === "member" || userRole === "trainer") return userRole;
        return "";
      })();
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

      setAppState((prev) => {
        const next = { ...prev };
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
          const currentUser = prev.currentUser;
          if (currentUser?.role === "member") {
            const normalizedUserEmail = currentUser.email.trim().toLowerCase();
            const localMember =
              prev.members.find((member) => member.id === prev.memberViewId) ??
              prev.members.find((member) => member.id === prev.selectedMemberId) ??
              prev.members.find((member) => member.email.trim().toLowerCase() === normalizedUserEmail) ??
              null;
            if (localMember) {
              const remoteIndex = resolveMemberRowMergeIndex(mergedMembers, localMember);
              const localGoalsCandidates = prev.members
                .filter((member) => member.email.trim().toLowerCase() === normalizedUserEmail)
                .map((member) => member.personalGoals);
              const bestLocalPersonalGoals = pickBestPersonalGoals(localGoalsCandidates);
              const bestGoalsForEmail = pickBestPersonalGoals([
                bestLocalPersonalGoals,
                localMember.personalGoals,
                ...mergedMembers
                  .filter((member) => member.email.trim().toLowerCase() === normalizedUserEmail)
                  .map((member) => member.personalGoals),
              ]);
              if (remoteIndex >= 0) {
                // Remote must win over stale per-device localStorage so profile edits sync across phone/PC.
                mergedMembers = mergedMembers.map((member, index) => {
                  if (index !== remoteIndex) return member;
                  const mergedRow = { ...localMember, ...member };
                  const remoteInv = member.invitedAt?.trim();
                  const localInv = localMember.invitedAt?.trim();
                  mergedRow.invitedAt = remoteInv || localInv || "";
                  mergedRow.personalGoals = bestGoalsForEmail || mergedRow.personalGoals;
                  return mergedRow;
                });
              } else {
                mergedMembers = [...mergedMembers, localMember];
              }
              if (bestGoalsForEmail) {
                mergedMembers = mergedMembers.map((member) => {
                  if (member.email.trim().toLowerCase() !== normalizedUserEmail) return member;
                  return { ...member, personalGoals: bestGoalsForEmail };
                });
              }
            }
          }
          if (currentUser?.role === "trainer") {
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

        if (trustRemotePrograms) {
          const mergedProgs = remotePrograms ?? [];
          if (mergedProgs.length > 0 || shouldAdoptRemote(mergedProgs, prev.programs)) {
            next.programs = mergeRemoteProgramsWithLocal(mergedProgs, prev.programs);
          }
        } else if (shouldAdoptRemote(remotePrograms, prev.programs)) {
          next.programs = mergeRemoteProgramsWithLocal(remotePrograms!, prev.programs);
        }

        if (trustRemoteLogs) {
          const mergedLogs = remoteLogs ?? [];
          if (mergedLogs.length > 0 || shouldAdoptRemote(mergedLogs, prev.logs)) {
            next.logs = mergedLogs;
          }
        } else if (shouldAdoptRemote(remoteLogs, prev.logs)) {
          next.logs = remoteLogs!;
        }

        if (shouldAdoptNonEmptyRemoteOnly(remoteExercises)) {
          next.exercises = remoteExercises;
        }

        if (prev.currentUser?.role === "member") {
          const normalizedCurrentEmail = prev.currentUser.email.trim().toLowerCase();
          const hydratedMember =
            next.members.find((member) => member.id === next.memberViewId) ??
            next.members.find((member) => member.id === next.selectedMemberId) ??
            next.members.find((member) => member.email.trim().toLowerCase() === normalizedCurrentEmail) ??
            null;
          const hydratedName = hydratedMember?.name.trim() ?? "";
          if (hydratedName && hydratedName !== prev.currentUser.name) {
            next.currentUser = {
              ...prev.currentUser,
              name: hydratedName,
            };
          }
        }

        return syncExercisesWithPrograms(next);
      });
    }

    remoteHydrateRef.current = async () => {
      await hydrateRemoteData();
    };

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
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  useEffect(() => {
    if (!INITIAL_SUPABASE_AUTH_FROM_URL?.stripSensitiveAfterCapture) return;
    stripSensitiveSupabaseAuthFromBrowserUrl();
  }, []);

  useEffect(() => {
    if (!isRecoveryMode || !recoveryTokenHash) return;
    let cancelled = false;
    async function hydrateRecoverySession() {
      const result = recoveryInviteFlow
        ? await verifyInviteToken(recoveryTokenHash)
        : await verifyRecoveryToken(recoveryTokenHash);
      if (cancelled) return;
      if (!result.ok) {
        setRecoveryError(
          recoveryInviteFlow ? `Invitasjonslenke feilet: ${result.message}` : `Recovery-lenke feilet: ${result.message}`,
        );
        return;
      }
      setRecoveryError(null);
      setRecoveryInfo(
        recoveryInviteFlow ? "Invitasjon verifisert. Velg et passord for kontoen din." : "Recovery-lenke verifisert. Du kan sette nytt passord.",
      );
    }
    void hydrateRecoverySession();
    return () => {
      cancelled = true;
    };
  }, [isRecoveryMode, recoveryInviteFlow, recoveryTokenHash]);

  useEffect(() => {
    if (!isRecoveryMode || !recoveryAccessToken || !recoveryRefreshToken) return;
    let cancelled = false;
    async function hydrateRecoverySessionFromTokens() {
      const result = await establishRecoverySessionFromTokens({
        accessToken: recoveryAccessToken,
        refreshToken: recoveryRefreshToken,
      });
      if (cancelled) return;
      if (!result.ok) {
        setRecoveryError(
          recoveryInviteFlow ? `Invitasjonslenke feilet: ${result.message}` : `Recovery-lenke feilet: ${result.message}`,
        );
        return;
      }
      setRecoveryError(null);
      setRecoveryInfo(
        recoveryInviteFlow
          ? "Invitasjon registrert. Velg et passord for kontoen din."
          : "Recovery-session opprettet. Du kan sette nytt passord.",
      );
    }
    void hydrateRecoverySessionFromTokens();
    return () => {
      cancelled = true;
    };
  }, [isRecoveryMode, recoveryInviteFlow, recoveryAccessToken, recoveryRefreshToken]);

  useEffect(() => {
    if (!isSupabaseConfigured || isRecoveryMode) return;
    let cancelled = false;

    async function hydrateSession() {
      if (typeof window !== "undefined" && supabaseClient) {
        const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const query = new URLSearchParams(window.location.search);
        const type = hash.get("type") ?? query.get("type");
        const recoveryFlag = hash.get("recovery") ?? query.get("recovery");
        const accessToken = hash.get("access_token") ?? query.get("access_token");
        const refreshToken = hash.get("refresh_token") ?? query.get("refresh_token");
        const implicitSession =
          Boolean(accessToken && refreshToken) &&
          type !== "recovery" &&
          type !== "invite" &&
          recoveryFlag !== "1";
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
        return;
      }
      setIsLocalDemoSession(false);
      setAppState((prev) => {
        const baseState = ensureMemberRecordForUser(prev, user, user.memberId ?? prev.memberViewId);
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
    }

    void hydrateSession();
    const {
      data: { subscription },
    } = supabaseClient.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      if (!session?.user) {
        setIsLocalDemoSession(false);
        setAppState((prev) => ({ ...prev, currentUser: null, role: "trainer" }));
        return;
      }
      const user = {
        id: session.user.id,
        role:
          session.user.app_metadata?.role === "member" || session.user.user_metadata?.role === "member"
            ? "member"
            : "trainer",
        name:
          (typeof session.user.user_metadata?.full_name === "string" && session.user.user_metadata.full_name) ||
          (typeof session.user.user_metadata?.name === "string" && session.user.user_metadata.name) ||
          (session.user.email ?? "Bruker"),
        email: session.user.email ?? "",
        memberId:
          typeof session.user.app_metadata?.member_id === "string"
            ? session.user.app_metadata.member_id
            : typeof session.user.user_metadata?.member_id === "string"
            ? session.user.user_metadata.member_id
            : undefined,
      } as AuthUser;
      setAppState((prev) => {
        const baseState = ensureMemberRecordForUser(prev, user, user.memberId ?? prev.memberViewId);
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
        const previousName = previousMember.name.trim().toLowerCase();
        const byEmail =
          previousEmail
            ? prev.members.find((member) => member.email.trim().toLowerCase() === previousEmail)
            : null;
        if (byEmail?.id) return byEmail.id;
        const byName =
          previousName
            ? prev.members.find((member) => member.name.trim().toLowerCase() === previousName)
            : null;
        if (byName?.id) return byName.id;
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
          const baseState = ensureMemberRecordForUser(prev, supabaseUser, supabaseUser.memberId ?? prev.memberViewId);
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
    setRecoveryPassword("");
    setRecoveryPasswordConfirm("");
    setRecoveryTokenHash(null);
    setRecoveryAccessToken(null);
    setRecoveryRefreshToken(null);
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
    const baseState = ensureMemberRecordForUser(appState, user, user.memberId ?? appState.memberViewId);
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
      const nextBase = ensureMemberRecordForUser(prev, user, resolvedMemberViewId || resolvedSelectedMemberId);
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
    setAppState((prev) => ({ ...prev, currentUser: null, role: "trainer" }));
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

  function addMember(input: CreateMemberInput) {
    setAppState((prev) => repository.addMember(prev, input));
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

    setAppState((prev) => syncExercisesWithPrograms(repository.saveProgram(prev, input)));
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
    setAppState((prev) => repository.startWorkoutMode(prev, programId, options));
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
    setAppState((prev) => repository.cancelWorkoutMode(prev));
  }

  function finishWorkoutMode(input?: FinishWorkoutInput) {
    setAppState((prev) => repository.finishWorkoutMode(prev, input));
    setMemberTab("progress");
  }

  function logGroupWorkout(input: LogGroupWorkoutInput) {
    setAppState((prev) => repository.logGroupWorkout(prev, input));
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

  async function restoreMemberByEmail(email: string): Promise<{ ok: boolean; message: string }> {
    if (!isSupabaseConfigured) {
      return { ok: false, message: "Gjenoppretting er ikke tilgjengelig akkurat nå." };
    }
    const result = await restoreMemberByEmailFromSupabase(email);
    if (!result.ok) return result;

    const {
      data: { session },
    } = supabaseClient ? await supabaseClient.auth.getSession() : { data: { session: null } };
    const ownerUserId = String(session?.user?.id ?? "").trim();
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
        members: remoteMembers,
        ...(remoteMessages ? { messages: remoteMessages } : {}),
        ...(remotePrograms ? { programs: mergeRemoteProgramsWithLocal(remotePrograms, prev.programs) } : {}),
        ...(remoteLogs ? { logs: remoteLogs } : {}),
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
    loginEmail,
    setLoginEmail,
    loginPassword,
    setLoginPassword,
    loginError,
    isRecoveryMode,
    recoveryInviteFlow,
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
    logCompletedPlanEntry,
    removeGroupWorkoutLog,
    removeCompletedPlanEntryLog,
    cancelWorkoutMode,
    dismissWorkoutCelebration,
    sendMemberMessage,
    inviteMember,
    inviteTrainer,
    restoreMemberByEmail,
    restoreMissingTestData,
    restoreOriginalExerciseBank,
    remoteTrainerPeriodPlansByMemberId,
    remoteMemberPeriodPlanRows,
  };
}
