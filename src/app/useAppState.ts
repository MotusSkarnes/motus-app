import { useEffect, useState } from "react";
import { STORAGE_KEY, demoUsers, getDefaultState } from "./data";
import { loadState, saveState } from "./storage";
import { localAppRepository, type CreateMemberInput, type FinishWorkoutInput, type LogGroupWorkoutInput, type RemoveGroupWorkoutLogInput, type RemoveWorkoutLogResultInput, type ReplaceWorkoutExerciseGroupInput, type SaveExerciseInput, type SaveProgramInput, type SetWorkoutLogResultsInput, type StartCustomWorkoutInput, type StartWorkoutModeOptions, type UpdateMemberInput } from "../services/appRepository";
import { isSupabaseConfigured, supabaseClient } from "../services/supabaseClient";
import { fetchExercisesFromSupabase, fetchHydratedMemberData, fetchHydratedTrainerData, fetchLogsFromSupabase, fetchMembersFromSupabase, fetchMessagesFromSupabase, fetchProgramsFromSupabase, restoreMemberByEmailFromSupabase, supabaseAppRepository } from "../services/supabaseRepository";
import { ensureMemberAuthLink, establishRecoverySessionFromTokens, getSupabaseSessionUser, inviteMemberByEmail, inviteTrainerByEmail, refreshSupabaseSessionUser, requestEmailOtpSignIn, requestPasswordRecovery, signInWithSupabase, signOutSupabase, updateSupabasePassword, verifyEmailOtpSignIn, verifyRecoveryToken, type InviteMemberResult, type InviteTrainerResult } from "../services/supabaseAuth";
import type { AppState, AuthUser, Exercise, MemberTab, PeriodSchedulePlan, TrainerTab } from "./types";

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

export function useAppState() {
  const isDemoMode = import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEMO_MODE === "true";
  const repository = isSupabaseConfigured ? supabaseAppRepository : localAppRepository;
  const [appState, setAppState] = useState<AppState>(() => loadState());
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [recoveryTokenHash, setRecoveryTokenHash] = useState<string | null>(null);
  const [recoveryAccessToken, setRecoveryAccessToken] = useState<string | null>(null);
  const [recoveryRefreshToken, setRecoveryRefreshToken] = useState<string | null>(null);
  const [recoveryPassword, setRecoveryPassword] = useState("");
  const [recoveryPasswordConfirm, setRecoveryPasswordConfirm] = useState("");
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [recoveryInfo, setRecoveryInfo] = useState<string | null>(null);
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
      customerType: "Oppfølging" as const,
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
        const aCount = programCountByMemberId.get(a.id) ?? 0;
        const bCount = programCountByMemberId.get(b.id) ?? 0;
        if (bCount !== aCount) return bCount - aCount;
        return a.id.localeCompare(b.id);
      })[0];
      if (bestCandidate) return bestCandidate.id;
    }
    if (memberId && members.some((member) => member.id === memberId)) return memberId;
    return fallbackId;
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
      const hydratedMember = isMemberLikeSession ? await fetchHydratedMemberData() : null;
      const remoteMembers = hydratedTrainer?.members ?? hydratedMember?.members ?? (await fetchMembersFromSupabase());
      const remoteMessages = hydratedTrainer?.messages ?? hydratedMember?.messages ?? (await fetchMessagesFromSupabase());
      const remotePrograms = hydratedTrainer?.programs ?? hydratedMember?.programs ?? (await fetchProgramsFromSupabase());
      const remoteLogs = hydratedTrainer?.logs ?? hydratedMember?.logs ?? (await fetchLogsFromSupabase());
      const remoteExercises =
        hydratedTrainer?.exercises ?? hydratedMember?.exercises ?? (await fetchExercisesFromSupabase());
      if (cancelled) return;

      if (hydratedTrainer) {
        const trainerHydrateStatus = hydratedTrainer.debug?.status;
        if (trainerHydrateStatus !== "invoke_error" && trainerHydrateStatus !== "invalid_payload") {
          setRemoteTrainerPeriodPlansByMemberId(hydratedTrainer.periodPlansByMemberId ?? {});
        }
      }
      if (hydratedMember) {
        setRemoteMemberPeriodPlanRows(hydratedMember.periodPlanRows ?? []);
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
              const remoteIndex = mergedMembers.findIndex(
                (member) =>
                  member.id === localMember.id || member.email.trim().toLowerCase() === localMember.email.trim().toLowerCase()
              );
              if (remoteIndex >= 0) {
                // Remote must win over stale per-device localStorage so profile edits sync across phone/PC.
                mergedMembers = mergedMembers.map((member, index) =>
                  index === remoteIndex ? { ...localMember, ...member } : member,
                );
              } else {
                mergedMembers = [...mergedMembers, localMember];
              }
            }
          }
          next.members = mergedMembers;
        }

        if (shouldAdoptRemote(remoteMessages, prev.messages)) {
          const remoteList = remoteMessages;
          const mergedMessages = [...remoteList];
          const remoteSignatureSet = new Set(
            remoteList.map((message) => `${message.memberId}::${message.sender}::${message.text.trim().toLowerCase()}`)
          );
          prev.messages.forEach((message) => {
            const looksLikeLocalOptimistic = message.id.startsWith("msg");
            if (!looksLikeLocalOptimistic) return;
            if (remoteList.some((remoteMessage) => remoteMessage.id === message.id)) return;
            const signature = `${message.memberId}::${message.sender}::${message.text.trim().toLowerCase()}`;
            if (remoteSignatureSet.has(signature)) return;
            mergedMessages.push(message);
          });
          next.messages = mergedMessages;
        }

        if (shouldAdoptRemote(remotePrograms, prev.programs)) {
          next.programs = remotePrograms;
        }

        if (shouldAdoptRemote(remoteLogs, prev.logs)) {
          next.logs = remoteLogs;
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

    void hydrateRemoteData();
    const interval = window.setInterval(() => {
      void hydrateRemoteData();
    }, 15000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured || typeof window === "undefined") return;
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const query = new URLSearchParams(window.location.search);
    const type = hash.get("type") ?? query.get("type");
    const recoveryFlag = hash.get("recovery") ?? query.get("recovery");
    const tokenHash = hash.get("token_hash") ?? query.get("token_hash");
    const accessToken = hash.get("access_token") ?? query.get("access_token");
    const refreshToken = hash.get("refresh_token") ?? query.get("refresh_token");
    if (type === "recovery" || recoveryFlag === "1") {
      setIsRecoveryMode(true);
      setRecoveryInfo("Recovery-lenke registrert. Velg nytt passord.");
      if (tokenHash) {
        setRecoveryTokenHash(tokenHash);
      }
      if (accessToken) {
        setRecoveryAccessToken(accessToken);
      }
      if (refreshToken) {
        setRecoveryRefreshToken(refreshToken);
      }
    }
  }, []);

  useEffect(() => {
    if (!isRecoveryMode || !recoveryTokenHash) return;
    let cancelled = false;
    async function hydrateRecoverySession() {
      const result = await verifyRecoveryToken(recoveryTokenHash);
      if (cancelled) return;
      if (!result.ok) {
        setRecoveryError(`Recovery-lenke feilet: ${result.message}`);
        return;
      }
      setRecoveryError(null);
      setRecoveryInfo("Recovery-lenke verifisert. Du kan sette nytt passord.");
    }
    void hydrateRecoverySession();
    return () => {
      cancelled = true;
    };
  }, [isRecoveryMode, recoveryTokenHash]);

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
        setRecoveryError(`Recovery-lenke feilet: ${result.message}`);
        return;
      }
      setRecoveryError(null);
      setRecoveryInfo("Recovery-session opprettet. Du kan sette nytt passord.");
    }
    void hydrateRecoverySessionFromTokens();
    return () => {
      cancelled = true;
    };
  }, [isRecoveryMode, recoveryAccessToken, recoveryRefreshToken]);

  useEffect(() => {
    if (!isSupabaseConfigured || isRecoveryMode) return;
    let cancelled = false;

    async function hydrateSession() {
      const user = await getSupabaseSessionUser();
      if (!user || cancelled) return;
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
    return () => {
      cancelled = true;
    };
  }, [isRecoveryMode]);

  useEffect(() => {
    if (!appState.members.length) return;
    const selectedExists = appState.members.some((member) => member.id === appState.selectedMemberId);
    const viewedExists = appState.members.some((member) => member.id === appState.memberViewId);

    if (!selectedExists || !viewedExists) {
      setAppState((prev) => ({
        ...prev,
        selectedMemberId: selectedExists ? prev.selectedMemberId : prev.members[0]?.id ?? "",
        memberViewId: viewedExists ? prev.memberViewId : prev.members[0]?.id ?? "",
      }));
    }
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

  function patchState(patch: Partial<AppState>) {
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
    setRecoveryInfo("Passord oppdatert. Logg inn med nytt passord.");
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
      if (result.message.toLowerCase().includes("for mange foresporsler")) {
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

  function deleteProgramById(programId: string) {
    setAppState((prev) => repository.deleteProgram(prev, programId));
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

  function replaceWorkoutExerciseGroup(input: ReplaceWorkoutExerciseGroupInput) {
    setAppState((prev) => repository.replaceWorkoutExerciseGroup(prev, input));
  }

  function removeWorkoutLogResult(input: RemoveWorkoutLogResultInput) {
    setAppState((prev) => repository.removeWorkoutLogResult(prev, input));
  }

  function setWorkoutLogResults(input: SetWorkoutLogResultsInput) {
    setAppState((prev) => repository.setWorkoutLogResults(prev, input));
  }

  function updateWorkoutModeNote(note: string) {
    setAppState((prev) => repository.updateWorkoutNote(prev, note));
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

  function sendMemberMessage(memberId: string, text: string) {
    if (!text.trim()) return;
    setAppState((prev) => repository.appendMemberMessage(prev, memberId, text));
  }

  function dismissWorkoutCelebration() {
    setAppState((prev) => ({ ...prev, workoutCelebration: null }));
  }

  async function inviteMember(email: string, memberId: string): Promise<InviteMemberResult> {
    if (!isSupabaseConfigured) {
      return { ok: false, message: "Invitasjon krever Supabase-oppsett." };
    }
    return inviteMemberByEmail(email, memberId);
  }

  async function restoreMemberByEmail(email: string): Promise<{ ok: boolean; message: string }> {
    if (!isSupabaseConfigured) {
      return { ok: false, message: "Gjenoppretting krever Supabase-oppsett." };
    }
    const result = await restoreMemberByEmailFromSupabase(email);
    if (!result.ok) return result;
    const remoteMembers = await fetchMembersFromSupabase();
    if (remoteMembers) {
      setAppState((prev) => ({ ...prev, members: remoteMembers }));
    }
    return result;
  }

  async function inviteTrainer(email: string): Promise<InviteTrainerResult> {
    if (!isSupabaseConfigured) {
      return { ok: false, message: "Invitasjon krever Supabase-oppsett." };
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

  return {
    appState,
    loginEmail,
    setLoginEmail,
    loginPassword,
    setLoginPassword,
    loginError,
    isRecoveryMode,
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
    addMember,
    deactivateMember,
    deleteMember,
    updateMember,
    markMemberInvited,
    saveProgramForMember,
    deleteProgramById,
    sendTrainerMessage,
    saveExercise,
    deleteExercise,
    startWorkoutMode,
    startCustomWorkout,
    updateWorkoutExerciseResult,
    replaceWorkoutExerciseGroup,
    removeWorkoutLogResult,
    setWorkoutLogResults,
    updateWorkoutModeNote,
    finishWorkoutMode,
    logGroupWorkout,
    removeGroupWorkoutLog,
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
