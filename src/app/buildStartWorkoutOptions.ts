import { programExerciseHoldSeconds } from "./exerciseCategories";
import { programExerciseUsesSecondsLoad } from "./exercisePrescriptionFields";
import type { Exercise, TrainingProgram } from "./types";
import type { StartWorkoutModeOptions } from "../services/appRepository";

/**
 * Forslag til startvekter fra programmal (ingen historikk). Brukes fra trener/live-PT-flow.
 */
export function buildDefaultStartWorkoutOptions(program: TrainingProgram, exerciseBank: Exercise[]): StartWorkoutModeOptions {
  const suggestedWeightByProgramExerciseId: Record<string, string> = {};
  program.exercises.forEach((exercise) => {
    if (Number(exercise.durationMinutes) > 0) return;
    const meta = exerciseBank.find((e) => e.id === exercise.exerciseId);
    const isSecondsLoad = programExerciseUsesSecondsLoad(exercise, meta);
    const suggested = isSecondsLoad
      ? programExerciseHoldSeconds(exercise, meta?.category) || String(exercise.weight ?? "").trim() || "30"
      : String(exercise.weight ?? "").trim();
    if (!suggested) return;
    suggestedWeightByProgramExerciseId[exercise.id] = suggested;
  });
  return { suggestedWeightByProgramExerciseId };
}
