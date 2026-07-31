import { STORAGE_KEY, getDefaultState, getSupabaseBootstrapState } from "./data";
import { migrateCatalogSchemaVersion } from "./memberLocalCatalog";
import { isSupabaseConfigured } from "../services/supabaseClient";
import type { AppState } from "./types";

export function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function shouldUseSupabaseProductionBootstrap(): boolean {
  if (!isSupabaseConfigured) return false;
  return !(import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEMO_MODE === "true");
}

export function loadState(): AppState {
  if (typeof window === "undefined") {
    return shouldUseSupabaseProductionBootstrap() ? getSupabaseBootstrapState() : getDefaultState();
  }
  try {
    if (shouldUseSupabaseProductionBootstrap()) {
      migrateCatalogSchemaVersion();
    }
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return shouldUseSupabaseProductionBootstrap() ? getSupabaseBootstrapState() : getDefaultState();
    }
    const parsed = JSON.parse(raw) as Partial<AppState>;
    const defaults = getDefaultState();
    const defaultExercisesById = new Map(defaults.exercises.map((exercise) => [exercise.id, exercise]));
    const normalizedExercises = Array.isArray(parsed.exercises)
      ? parsed.exercises.map((exerciseLike) => {
          const exercise = exerciseLike as AppState["exercises"][number];
          const fallback = defaultExercisesById.get(exercise.id);
          return {
            ...exercise,
            category: exercise.category ?? fallback?.category ?? "Styrke",
            description: exercise.description ?? fallback?.description ?? "",
          };
        })
      : defaults.exercises;
    return {
      workoutMode: parsed.workoutMode ?? defaults.workoutMode,
      workoutCelebration: defaults.workoutCelebration,
      members: Array.isArray(parsed.members) ? parsed.members : defaults.members,
      exercises: normalizedExercises,
      programs: Array.isArray(parsed.programs) ? parsed.programs : defaults.programs,
      logs: Array.isArray(parsed.logs) ? parsed.logs : defaults.logs,
      messages: Array.isArray(parsed.messages) ? parsed.messages : defaults.messages,
      currentUser: parsed.currentUser ?? defaults.currentUser,
      role: parsed.role ?? defaults.role,
      selectedMemberId: parsed.selectedMemberId ?? defaults.selectedMemberId,
      memberViewId: parsed.memberViewId ?? defaults.memberViewId,
    };
  } catch {
    return getDefaultState();
  }
}

export function saveState(state: AppState) {
  if (typeof window === "undefined") return;
  const fullState = JSON.stringify({ ...state, workoutCelebration: null });
  try {
    window.localStorage.setItem(STORAGE_KEY, fullState);
    return;
  } catch {
    // Remote catalogs can exceed the browser's localStorage quota. They are
    // hydrated again from Supabase, so retain only session-critical state.
  }

  const currentMemberId = state.currentUser?.memberId?.trim() || state.memberViewId?.trim() || "";
  const compactState: Partial<AppState> = {
    workoutMode: state.workoutMode,
    workoutCelebration: null,
    members: currentMemberId ? state.members.filter((member) => member.id === currentMemberId) : [],
    exercises: [],
    programs: [],
    logs: [],
    messages: [],
    currentUser: state.currentUser,
    role: state.role,
    selectedMemberId: state.selectedMemberId,
    memberViewId: state.memberViewId,
  };

  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(compactState));
  } catch {
    // Storage may be disabled or completely full. Runtime state remains valid;
    // never crash an active workout because offline caching failed.
  }
}
