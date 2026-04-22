import { useEffect, useState } from "react";
import { STORAGE_KEY, demoUsers, getDefaultState } from "./data";
import { loadState, saveState } from "./storage";
import { localAppRepository, type CreateMemberInput, type SaveExerciseInput, type SaveProgramInput } from "../services/appRepository";
import { isSupabaseConfigured, supabaseClient } from "../services/supabaseClient";
import { fetchExercisesFromSupabase, fetchHydratedTrainerData, fetchLogsFromSupabase, fetchMembersFromSupabase, fetchMessagesFromSupabase, fetchProgramsFromSupabase, restoreMemberByEmailFromSupabase, supabaseAppRepository } from "../services/supabaseRepository";
import { establishRecoverySessionFromTokens, getSupabaseSessionUser, inviteMemberByEmail, requestPasswordRecovery, signInWithSupabase, signOutSupabase, updateSupabasePassword, verifyRecoveryToken, type InviteMemberResult } from "../services/supabaseAuth";
import type { AppState, MemberTab, TrainerTab } from "./types";

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
  const [trainerTab, setTrainerTab] = useState<TrainerTab>("dashboard");
  const [memberTab, setMemberTab] = useState<MemberTab>("overview");

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

      const hydrated = ownerUserId ? await fetchHydratedTrainerData(ownerUserId) : null;
      const remoteMembers = hydrated?.members ?? (await fetchMembersFromSupabase());
      const remoteMessages = hydrated?.messages ?? (await fetchMessagesFromSupabase());
      const remotePrograms = hydrated?.programs ?? (await fetchProgramsFromSupabase());
      const remoteLogs = hydrated?.logs ?? (await fetchLogsFromSupabase());
      const remoteExercises = hydrated?.exercises ?? (await fetchExercisesFromSupabase());
      if (cancelled) return;

      setAppState((prev) => {
        const next = { ...prev };
        const shouldAdoptRemote = <T,>(remoteRows: T[] | null, localRows: T[]) => {
          if (!remoteRows) return false;
          if (remoteRows.length > 0) return true;
          return localRows.length === 0;
        };

        if (shouldAdoptRemote(remoteMembers, prev.members)) {
          next.members = remoteMembers;
        }

        if (shouldAdoptRemote(remoteMessages, prev.messages)) {
          next.messages = remoteMessages;
        }

        if (shouldAdoptRemote(remotePrograms, prev.programs)) {
          next.programs = remotePrograms;
        }

        if (shouldAdoptRemote(remoteLogs, prev.logs)) {
          next.logs = remoteLogs;
        }

        if (shouldAdoptRemote(remoteExercises, prev.exercises)) {
          next.exercises = remoteExercises;
        }

        return next;
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
    const tokenHash = hash.get("token_hash") ?? query.get("token_hash");
    const accessToken = hash.get("access_token") ?? query.get("access_token");
    const refreshToken = hash.get("refresh_token") ?? query.get("refresh_token");
    if (type === "recovery") {
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
      setAppState((prev) => ({
        ...prev,
        currentUser: user,
        role: user.role,
        selectedMemberId: user.memberId ?? prev.selectedMemberId,
        memberViewId: user.memberId ?? prev.memberViewId,
      }));
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
        setAppState((prev) => ({
          ...prev,
          currentUser: supabaseUser,
          role: supabaseUser.role,
          selectedMemberId: supabaseUser.memberId ?? prev.selectedMemberId,
          memberViewId: supabaseUser.memberId ?? prev.memberViewId,
        }));
        setTrainerTab("dashboard");
        setMemberTab("overview");
        setLoginError(null);
        return;
      }

      // Fallback for local demo users when demo mode is enabled.
      if (isDemoMode && matchedDemoUser) {
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
  }

  async function handleLogout() {
    if (isSupabaseConfigured) {
      await signOutSupabase();
    }
    setAppState((prev) => ({ ...prev, currentUser: null, role: "trainer" }));
    setLoginEmail("");
    setLoginPassword("");
    setLoginError(null);
  }

  function resetAllData() {
    setAppState(getDefaultState());
    setTrainerTab("dashboard");
    setMemberTab("overview");
    setLoginEmail("");
    setLoginPassword("");
    setLoginError(null);
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

  function markMemberInvited(memberId: string, invitedAtIso?: string) {
    setAppState((prev) => repository.markMemberInvited(prev, memberId, invitedAtIso));
  }

  function saveProgramForMember(input: SaveProgramInput) {
    if (!input.title.trim() || !input.memberId) return;

    setAppState((prev) => repository.saveProgram(prev, input));
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

  function startWorkoutMode(programId: string) {
    setAppState((prev) => repository.startWorkoutMode(prev, programId));
  }

  function updateWorkoutExerciseResult(exerciseId: string, field: "performedWeight" | "performedReps" | "completed", value: string | boolean) {
    setAppState((prev) => repository.updateWorkoutResult(prev, { exerciseId, field, value }));
  }

  function updateWorkoutModeNote(note: string) {
    setAppState((prev) => repository.updateWorkoutNote(prev, note));
  }

  function cancelWorkoutMode() {
    setAppState((prev) => repository.cancelWorkoutMode(prev));
  }

  function finishWorkoutMode() {
    setAppState((prev) => repository.finishWorkoutMode(prev));
    setMemberTab("progress");
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
    trainerTab,
    setTrainerTab,
    memberTab,
    setMemberTab,
    patchState,
    handleLogin,
    handleQuickLogin,
    completePasswordRecovery,
    sendPasswordRecoveryEmail,
    showQuickLogin: isDemoMode,
    handleLogout,
    resetAllData,
    addMember,
    deactivateMember,
    deleteMember,
    markMemberInvited,
    saveProgramForMember,
    deleteProgramById,
    sendTrainerMessage,
    saveExercise,
    startWorkoutMode,
    updateWorkoutExerciseResult,
    updateWorkoutModeNote,
    finishWorkoutMode,
    cancelWorkoutMode,
    dismissWorkoutCelebration,
    sendMemberMessage,
    inviteMember,
    restoreMemberByEmail,
  };
}
