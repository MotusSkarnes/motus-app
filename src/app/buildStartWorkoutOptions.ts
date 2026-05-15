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
    const isStretch = meta?.category === "Uttøyning";
    const suggested = isStretch
      ? (exercise.holdSeconds ?? "").trim() || exercise.weight.trim() || "30"
      : exercise.weight.trim();
    if (!suggested) return;
    suggestedWeightByProgramExerciseId[exercise.id] = suggested;
  });
  return { suggestedWeightByProgramExerciseId };
}
