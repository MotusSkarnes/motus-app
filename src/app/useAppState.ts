import { useEffect, useState } from "react";
import { STORAGE_KEY, demoUsers, getDefaultState } from "./data";
import { loadState, saveState } from "./storage";
import { localAppRepository, type SaveProgramInput } from "../services/appRepository";
import { isSupabaseConfigured } from "../services/supabaseClient";
import { fetchLogsFromSupabase, fetchMembersFromSupabase, fetchMessagesFromSupabase, fetchProgramsFromSupabase, supabaseAppRepository } from "../services/supabaseRepository";
import { getSupabaseSessionUser, signInWithSupabase, signOutSupabase } from "../services/supabaseAuth";
import type { AppState, MemberTab, TrainerTab } from "./types";

export function useAppState() {
  const repository = isSupabaseConfigured ? supabaseAppRepository : localAppRepository;
  const [appState, setAppState] = useState<AppState>(() => loadState());
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [trainerTab, setTrainerTab] = useState<TrainerTab>("dashboard");
  const [memberTab, setMemberTab] = useState<MemberTab>("overview");

  useEffect(() => {
    saveState(appState);
  }, [appState]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    let cancelled = false;

    async function hydrateRemoteData() {
      const remoteMembers = await fetchMembersFromSupabase();
      const remoteMessages = await fetchMessagesFromSupabase();
      const remotePrograms = await fetchProgramsFromSupabase();
      const remoteLogs = await fetchLogsFromSupabase();
      if (cancelled) return;

      setAppState((prev) => {
        const next = { ...prev };

        if (remoteMembers && prev.members.length <= remoteMembers.length) {
          next.members = remoteMembers;
        }

        if (remoteMessages && prev.messages.length <= remoteMessages.length) {
          next.messages = remoteMessages;
        }

        if (remotePrograms && prev.programs.length <= remotePrograms.length) {
          next.programs = remotePrograms;
        }

        if (remoteLogs && prev.logs.length <= remoteLogs.length) {
          next.logs = remoteLogs;
        }

        return next;
      });
    }

    void hydrateRemoteData();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
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
  }, []);

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
    if (isSupabaseConfigured) {
      const supabaseUser = await signInWithSupabase(loginEmail.trim(), loginPassword);
      if (!supabaseUser) {
        setLoginError("Feil e-post eller passord.");
        return;
      }
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

    const matchedUser = demoUsers.find((user) => user.email.toLowerCase() === loginEmail.trim().toLowerCase() && user.password === loginPassword);
    if (!matchedUser) {
      setLoginError("Feil e-post eller passord.");
      return;
    }
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

  function handleQuickLogin(email: string) {
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

  function addMember() {
    setAppState((prev) => repository.addMember(prev));
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

  return {
    appState,
    loginEmail,
    setLoginEmail,
    loginPassword,
    setLoginPassword,
    loginError,
    trainerTab,
    setTrainerTab,
    memberTab,
    setMemberTab,
    patchState,
    handleLogin,
    handleQuickLogin,
    showQuickLogin: !isSupabaseConfigured,
    handleLogout,
    resetAllData,
    addMember,
    saveProgramForMember,
    deleteProgramById,
    sendTrainerMessage,
    startWorkoutMode,
    updateWorkoutExerciseResult,
    updateWorkoutModeNote,
    finishWorkoutMode,
    cancelWorkoutMode,
    sendMemberMessage,
  };
}
