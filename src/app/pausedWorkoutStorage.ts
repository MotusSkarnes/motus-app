import type { TrainingProgram, WorkoutModeState } from "./types";

export const PAUSED_WORKOUT_TTL_MS = 4 * 60 * 60 * 1000;
export const PAUSED_WORKOUTS_STORAGE_KEY = "motus.pausedWorkouts.v1";

export type PausedWorkoutDraft = {
  id: string;
  memberId: string;
  programId: string;
  programTitle: string;
  workoutMode: WorkoutModeState;
  /** Beholdes for midlertidige «Egen økt»-programmer som ellers fjernes ved avbryt. */
  programSnapshot?: TrainingProgram;
  updatedAt: number;
  expiresAt: number;
};

type PausedWorkoutStore = Record<string, PausedWorkoutDraft[]>;

function readStore(): PausedWorkoutStore {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(PAUSED_WORKOUTS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as PausedWorkoutStore;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeStore(store: PausedWorkoutStore): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PAUSED_WORKOUTS_STORAGE_KEY, JSON.stringify(store));
}

export function isPausedWorkoutDraftActive(draft: PausedWorkoutDraft, nowMs = Date.now()): boolean {
  return draft.expiresAt > nowMs;
}

export function purgeExpiredPausedWorkouts(nowMs = Date.now()): void {
  const store = readStore();
  let changed = false;
  const next: PausedWorkoutStore = {};
  for (const [memberId, drafts] of Object.entries(store)) {
    const active = (drafts ?? []).filter((draft) => isPausedWorkoutDraftActive(draft, nowMs));
    if (active.length > 0) next[memberId] = active;
    if (active.length !== (drafts ?? []).length) changed = true;
  }
  if (changed) writeStore(next);
}

export function listPausedWorkouts(memberId: string, nowMs = Date.now()): PausedWorkoutDraft[] {
  const trimmedMemberId = memberId.trim();
  if (!trimmedMemberId) return [];
  purgeExpiredPausedWorkouts(nowMs);
  const drafts = readStore()[trimmedMemberId] ?? [];
  return drafts
    .filter((draft) => isPausedWorkoutDraftActive(draft, nowMs))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getPausedWorkoutByProgramId(memberId: string, programId: string): PausedWorkoutDraft | null {
  const trimmedProgramId = programId.trim();
  if (!trimmedProgramId) return null;
  return listPausedWorkouts(memberId).find((draft) => draft.programId === trimmedProgramId) ?? null;
}

export function getPausedWorkoutById(memberId: string, draftId: string): PausedWorkoutDraft | null {
  const trimmedDraftId = draftId.trim();
  if (!trimmedDraftId) return null;
  return listPausedWorkouts(memberId).find((draft) => draft.id === trimmedDraftId) ?? null;
}

export type UpsertPausedWorkoutInput = {
  memberId: string;
  programId: string;
  programTitle: string;
  workoutMode: WorkoutModeState;
  programSnapshot?: TrainingProgram;
  nowMs?: number;
};

export function upsertPausedWorkout(input: UpsertPausedWorkoutInput): PausedWorkoutDraft {
  const nowMs = input.nowMs ?? Date.now();
  const memberId = input.memberId.trim();
  const programId = input.programId.trim();
  const existing = getPausedWorkoutByProgramId(memberId, programId);
  const draft: PausedWorkoutDraft = {
    id: existing?.id ?? `paused-${programId}-${nowMs}`,
    memberId,
    programId,
    programTitle: input.programTitle.trim() || existing?.programTitle || "Økt",
    workoutMode: input.workoutMode,
    ...(input.programSnapshot ? { programSnapshot: input.programSnapshot } : {}),
    updatedAt: nowMs,
    expiresAt: nowMs + PAUSED_WORKOUT_TTL_MS,
  };

  const store = readStore();
  const memberDrafts = store[memberId] ?? [];
  const withoutProgram = memberDrafts.filter((item) => item.programId !== programId);
  store[memberId] = [draft, ...withoutProgram];
  writeStore(store);
  return draft;
}

export function removePausedWorkout(memberId: string, draftId: string): void {
  const trimmedMemberId = memberId.trim();
  const trimmedDraftId = draftId.trim();
  if (!trimmedMemberId || !trimmedDraftId) return;
  const store = readStore();
  const memberDrafts = store[trimmedMemberId] ?? [];
  const nextDrafts = memberDrafts.filter((draft) => draft.id !== trimmedDraftId);
  if (nextDrafts.length === 0) {
    delete store[trimmedMemberId];
  } else {
    store[trimmedMemberId] = nextDrafts;
  }
  writeStore(store);
}

export function removePausedWorkoutByProgramId(memberId: string, programId: string): void {
  const draft = getPausedWorkoutByProgramId(memberId, programId);
  if (!draft) return;
  removePausedWorkout(memberId, draft.id);
}

export function pausedWorkoutProgress(workoutMode: WorkoutModeState): { completed: number; total: number } {
  const total = workoutMode.results.length;
  const completed = workoutMode.results.filter((result) => result.completed).length;
  return { completed, total };
}

export function formatPausedWorkoutExpiry(expiresAt: number, nowMs = Date.now()): string {
  const remainingMs = Math.max(0, expiresAt - nowMs);
  if (remainingMs <= 0) return "Utløper snart";
  const totalMinutes = Math.ceil(remainingMs / 60_000);
  if (totalMinutes < 60) return `Utløper om ${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (minutes === 0) return `Utløper om ${hours} t`;
  return `Utløper om ${hours} t ${minutes} min`;
}
