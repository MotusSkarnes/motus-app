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
