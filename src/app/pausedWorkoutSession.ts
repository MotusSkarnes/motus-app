import { ensureWorkoutModeSessionMetadata } from "../services/appRepository";
import {
  getPausedWorkoutById,
  removePausedWorkout,
  removePausedWorkoutByProgramId,
  removePausedWorkoutByProgramIdEverywhere,
  upsertPausedWorkout,
} from "./pausedWorkoutStorage";
import type { AppState, ProgramExercise, TrainingProgram, WorkoutModeState } from "./types";

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
    programSnapshot: program ?? undefined,
  });
}

/** Gjenoppretter program fra økt-rader når programmet ikke finnes i state (f.eks. etter pause). */
export function buildTrainingProgramFromWorkoutMode(workoutMode: WorkoutModeState): TrainingProgram {
  const seen = new Set<string>();
  const exercises: ProgramExercise[] = [];
  for (const result of workoutMode.results) {
    const programExerciseId = result.programExerciseId?.trim() || result.exerciseId;
    if (!programExerciseId || seen.has(programExerciseId)) continue;
    seen.add(programExerciseId);
    exercises.push({
      id: programExerciseId,
      exerciseId: result.exerciseId,
      exerciseName: result.exerciseName,
      sets: result.plannedSets || "1",
      reps: result.plannedReps || "",
      weight: result.plannedWeight || "",
      durationMinutes: result.plannedDurationMinutes,
      speed: result.plannedSpeed,
      incline: result.plannedIncline,
      restSeconds: "",
      notes: "",
      blockId: result.blockId,
      blockType: result.blockType,
    });
  }
  return {
    id: workoutMode.programId,
    memberId: workoutMode.memberId?.trim() || "",
    title: workoutMode.programTitle?.trim() || "Økt",
    goal: "",
    notes: "",
    createdAt: "",
    exercises,
    ephemeral: true,
  };
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
  const existingIndex = nextPrograms.findIndex((program) => program.id === draft.programId);
  if (draft.programSnapshot) {
    if (existingIndex >= 0) {
      nextPrograms = nextPrograms.map((program, index) =>
        index === existingIndex ? draft.programSnapshot! : program,
      );
    } else {
      nextPrograms = [draft.programSnapshot, ...nextPrograms];
    }
  } else if (existingIndex < 0 && draft.workoutMode.results.length > 0) {
    nextPrograms = [buildTrainingProgramFromWorkoutMode(draft.workoutMode), ...nextPrograms];
  }

  const programForBaseline =
    draft.programSnapshot ?? nextPrograms.find((program) => program.id === draft.programId) ?? null;

  return {
    ...state,
    programs: nextPrograms,
    workoutMode: ensureWorkoutModeSessionMetadata(draft.workoutMode, programForBaseline, state.exercises),
  };
}

export function discardPausedWorkoutDraftForMember(memberId: string, draftId: string): void {
  removePausedWorkout(memberId, draftId);
}

export function clearPausedWorkoutForProgram(memberId: string, programId: string): void {
  removePausedWorkoutByProgramIdEverywhere(programId, memberId ? [memberId] : []);
}
