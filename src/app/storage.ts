import { STORAGE_KEY, getDefaultState } from "./data";
import type { AppState } from "./types";

export function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

export function loadState(): AppState {
  if (typeof window === "undefined") return getDefaultState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultState();
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
      workoutCelebration: parsed.workoutCelebration ?? defaults.workoutCelebration,
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
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
