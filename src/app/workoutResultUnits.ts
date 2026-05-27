import { isHoldBasedExerciseCategory } from "./exerciseCategories";
import type { WorkoutExerciseResult } from "./types";

export function resolveWorkoutLoadUnit(row: Pick<WorkoutExerciseResult, "performedLoadUnit" | "plannedWeightUnit" | "exerciseCategory">): "kg" | "sec" {
  if (row.performedLoadUnit === "sec") return "sec";
  if (row.performedLoadUnit === "kg") return "kg";
  if (row.plannedWeightUnit === "seconds") return "sec";
  if (row.exerciseCategory && isHoldBasedExerciseCategory(row.exerciseCategory)) return "sec";
  return "kg";
}

export function resolveWorkoutRepsUnit(row: Pick<WorkoutExerciseResult, "plannedRepsUnit">): "reps" | "min" {
  return row.plannedRepsUnit === "minutes" ? "min" : "reps";
}

export function isKgBasedWorkoutResult(
  row: Pick<WorkoutExerciseResult, "performedLoadUnit" | "plannedWeightUnit" | "exerciseCategory">,
): boolean {
  return resolveWorkoutLoadUnit(row) === "kg";
}

export function isSecondsBasedWorkoutResult(
  row: Pick<WorkoutExerciseResult, "performedLoadUnit" | "plannedWeightUnit" | "exerciseCategory">,
): boolean {
  return resolveWorkoutLoadUnit(row) === "sec";
}

export function formatWorkoutPlannedRepsDisplay(
  row: Pick<WorkoutExerciseResult, "plannedReps" | "plannedRepsUnit">,
): string {
  const raw = String(row.plannedReps ?? "").trim();
  if (!raw) return "—";
  return resolveWorkoutRepsUnit(row) === "min" ? `${raw} min` : raw;
}

export function formatWorkoutPlannedLoadDisplay(
  row: Pick<
    WorkoutExerciseResult,
    "plannedWeight" | "plannedWeightUnit" | "plannedDurationMinutes" | "exerciseCategory" | "performedLoadUnit"
  >,
  options?: { isCardio?: boolean },
): string {
  if (options?.isCardio) {
    const minutes = String(row.plannedDurationMinutes ?? "").trim();
    return minutes ? `${minutes} min` : "—";
  }
  const raw = String(row.plannedWeight ?? "").trim();
  if (!raw) return "—";
  return resolveWorkoutLoadUnit(row) === "sec" ? `${raw} sek` : `${raw} kg`;
}
