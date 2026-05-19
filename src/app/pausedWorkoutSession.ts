import {
  getPausedWorkoutById,
  removePausedWorkout,
  removePausedWorkoutByProgramId,
  upsertPausedWorkout,
} from "./pausedWorkoutStorage";
import type { AppState } from "./types";

function resolvePausedWorkoutMemberId(state: AppState, memberIdHint?: string): string {
  const fromHint = memberIdHint?.trim() ?? "";
  if (fromHint) return fromHint;
  const fromWorkout = state.workoutMode?.memberId?.trim() ?? "";
  if (fromWorkout) return fromWorkout;
  return state.memberViewId?.trim() ?? state.currentUser?.memberId?.trim() ?? "";
}

export function persistPausedWorkoutFromState(state: AppState, memberIdHint?: string): void {
  const workoutMode = state.workoutMode;
  if (!workoutMode) return;
  const memberId = resolvePausedWorkoutMemberId(state, memberIdHint);
  if (!memberId) return;
  const program = state.programs.find((item) => item.id === workoutMode.programId);
  const hasProgress =
    workoutMode.results.some((result) => result.completed) ||
    workoutMode.note.trim().length > 0 ||
    workoutMode.results.some(
      (result) =>
        result.performedWeight.trim() ||
        result.performedReps.trim() ||
        (result.performedDurationMinutes ?? "").trim() ||
        (result.exerciseNote ?? "").trim(),
    );
  if (!hasProgress) {
    removePausedWorkoutByProgramId(memberId, workoutMode.programId);
    return;
  }
  upsertPausedWorkout({
    memberId,
    programId: workoutMode.programId,
    programTitle: workoutMode.programTitle ?? program?.title ?? "Økt",
    workoutMode,
    programSnapshot: program?.ephemeral ? program : undefined,
  });
}

export function dismissWorkoutModeInState(state: AppState): AppState {
  if (!state.workoutMode) return state;
  persistPausedWorkoutFromState(state);
  const program = state.programs.find((item) => item.id === state.workoutMode?.programId);
  const programs = program?.ephemeral ? state.programs.filter((item) => item.id !== program.id) : state.programs;
  return { ...state, programs, workoutMode: null };
}

export function resumePausedWorkoutInState(state: AppState, draftId: string, memberIdHint?: string): AppState {
  const memberId = resolvePausedWorkoutMemberId(state, memberIdHint);
  if (!memberId) return state;
  const draft = getPausedWorkoutById(memberId, draftId);
  if (!draft) return state;

  let nextPrograms = state.programs;
  const programExists = nextPrograms.some((program) => program.id === draft.programId);
  if (!programExists && draft.programSnapshot) {
    nextPrograms = [draft.programSnapshot, ...nextPrograms];
  }

  return {
    ...state,
    programs: nextPrograms,
    workoutMode: draft.workoutMode,
  };
}

export function discardPausedWorkoutDraftForMember(memberId: string, draftId: string): void {
  removePausedWorkout(memberId, draftId);
}

export function clearPausedWorkoutForProgram(memberId: string, programId: string): void {
  removePausedWorkoutByProgramId(memberId, programId);
}
