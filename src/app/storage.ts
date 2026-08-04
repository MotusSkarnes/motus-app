import { STORAGE_KEY, getDefaultState, getSupabaseBootstrapState } from "./data";
import { migrateCatalogSchemaVersion } from "./memberLocalCatalog";
import { normalizeProgramExercises } from "./normalizeProgramExercise";
import { isSupabaseConfigured } from "../services/supabaseClient";
import type { AppState, TrainingProgram } from "./types";

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
    const programs = Array.isArray(parsed.programs)
      ? parsed.programs.map((programLike) => {
          const program = programLike as TrainingProgram;
          return {
            ...program,
            exercises: normalizeProgramExercises(program.exercises),
          };
        })
      : defaults.programs;
    return {
      workoutMode: parsed.workoutMode ?? defaults.workoutMode,
      workoutCelebration: defaults.workoutCelebration,
      members: Array.isArray(parsed.members) ? parsed.members : defaults.members,
      exercises: normalizedExercises,
      programs,
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
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, workoutCelebration: null }));
}
