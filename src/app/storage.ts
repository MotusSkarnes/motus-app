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
    return {
      workoutMode: parsed.workoutMode ?? defaults.workoutMode,
      members: Array.isArray(parsed.members) ? parsed.members : defaults.members,
      exercises: Array.isArray(parsed.exercises) ? parsed.exercises : defaults.exercises,
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
