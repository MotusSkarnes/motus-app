import { formatProgramExercisePrescription, formatWorkoutResultPerformedLabel, resolveProgramExerciseName } from "./programExercisePresentation";
import type { Exercise, ProgramExercise, TrainingProgram, WorkoutExerciseResult, WorkoutLog } from "./types";

export type PeriodPlanSessionReviewSet = {
  setNumber: number;
  performedLabel: string;
  completed: boolean;
  note: string;
};

export type PeriodPlanSessionReviewExercise = {
  id: string;
  name: string;
  plannedLabel: string;
  notes: string;
  addedDuringWorkout: boolean;
  sets: PeriodPlanSessionReviewSet[];
};

function resultMatchesExercise(result: WorkoutExerciseResult, exercise: ProgramExercise): boolean {
  const programId = result.programExerciseId?.trim();
  if (programId && programId === exercise.id.trim()) return true;
  const exerciseId = result.exerciseId.trim();
  if (exercise.id.trim() && exerciseId.startsWith(`${exercise.id.trim()}-set-`)) return true;
  if (exercise.exerciseId.trim() && exerciseId === exercise.exerciseId.trim()) return true;
  const name = result.exerciseName.trim().toLowerCase();
  return Boolean(name) && name === exercise.exerciseName.trim().toLowerCase();
}

function takeMatchingResults(exercise: ProgramExercise, remaining: WorkoutExerciseResult[]): WorkoutExerciseResult[] {
  const byProgramId = remaining.filter((result) => result.programExerciseId?.trim() === exercise.id.trim());
  if (byProgramId.length > 0) return byProgramId;
  return remaining.filter((result) => resultMatchesExercise(result, exercise));
}

function toReviewSets(rows: WorkoutExerciseResult[], exerciseLibrary: Exercise[]): PeriodPlanSessionReviewSet[] {
  return rows.map((row, index) => ({
    setNumber: row.setNumber && row.setNumber > 0 ? row.setNumber : index + 1,
    performedLabel: formatWorkoutResultPerformedLabel(row, exerciseLibrary),
    completed: row.completed === true,
    note: row.exerciseNote?.trim() ?? "",
  }));
}

function leftoverResultKey(result: WorkoutExerciseResult): string {
  return (
    result.programExerciseId?.trim() ||
    result.exerciseId.replace(/-set-\d+$/i, "").trim() ||
    result.exerciseName.trim().toLowerCase() ||
    result.exerciseId
  );
}

/** Bygger plan vs. utført per øvelse for trenerens øktgjennomgang. */
export function buildPeriodPlanSessionReview(input: {
  program: TrainingProgram | null;
  log: WorkoutLog | null;
  exerciseLibrary?: Exercise[];
}): PeriodPlanSessionReviewExercise[] {
  const exerciseLibrary = input.exerciseLibrary ?? [];
  const remaining = [...(input.log?.results ?? [])];
  const review: PeriodPlanSessionReviewExercise[] = [];
  const plannedExercises = Array.isArray(input.program?.exercises) ? input.program.exercises : [];

  plannedExercises.forEach((exercise, exerciseIndex) => {
    const matched = takeMatchingResults(exercise, remaining);
    matched.forEach((row) => {
      const index = remaining.indexOf(row);
      if (index >= 0) remaining.splice(index, 1);
    });
    review.push({
      id: exercise.id || `planned-${exerciseIndex}`,
      name: resolveProgramExerciseName(plannedExercises, exerciseIndex),
      plannedLabel: formatProgramExercisePrescription(exercise, exerciseIndex, plannedExercises, exerciseLibrary),
      notes: exercise.notes?.trim() ?? "",
      addedDuringWorkout: false,
      sets: toReviewSets(matched, exerciseLibrary),
    });
  });

  const leftoverGroups = new Map<string, WorkoutExerciseResult[]>();
  remaining.forEach((result) => {
    const key = leftoverResultKey(result);
    const group = leftoverGroups.get(key) ?? [];
    group.push(result);
    leftoverGroups.set(key, group);
  });
  leftoverGroups.forEach((rows, key) => {
    review.push({
      id: key,
      name: rows[0]?.exerciseName.trim() || "Øvelse",
      plannedLabel: "",
      notes: "",
      addedDuringWorkout: rows.some((row) => row.addedDuringWorkout === true) || plannedExercises.length > 0,
      sets: toReviewSets(rows, exerciseLibrary),
    });
  });

  return review;
}
