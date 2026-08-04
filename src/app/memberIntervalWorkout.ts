import {
  isConditioningIntervalProgram,
  isConditioningLogAfterProgram,
  programHasConfiguredLogAfterFields,
} from "./conditioningProgramMode";
import type { Exercise, TrainingProgram } from "./types";
import { getTrainingProgramSubTab, isConditioningTrainingProgram } from "./trainingProgramKind";

const INTERVAL_TITLE_PATTERN = /4x4|intervall|tempo|kondisjon|mølle|moelle|tredemølle|drag/i;

const INTERVAL_EXERCISE_NAME_PATTERN = /\bdrag\b|intervall|oppvarm|nedjogg|nedtrapp|tempo|tabata|mølle|moelle/i;

function hasIntervalStepStructure(program: Pick<TrainingProgram, "exercises">): boolean {
  return program.exercises.some((exercise) => {
    if (exercise.logFieldKeys?.length) return false;
    const name = String(exercise.exerciseName ?? "").trim();
    if (INTERVAL_EXERCISE_NAME_PATTERN.test(name)) return true;
    if (Number(exercise.durationMinutes) > 0) return true;
    const holdSeconds = Number(exercise.holdSeconds) || 0;
    return holdSeconds > 0;
  });
}

function looksLikeDedicatedIntervalProgram(
  program: Pick<TrainingProgram, "title" | "exercises" | "notes" | "conditioningDeliveryMode">,
  exerciseCategoryById: Map<string, Exercise["category"]>,
  exerciseBank: Exercise[],
): boolean {
  const title = program.title?.trim() ?? "";
  if (INTERVAL_TITLE_PATTERN.test(title)) return true;
  if (
    program.exercises.some((exercise) =>
      INTERVAL_EXERCISE_NAME_PATTERN.test(String(exercise.exerciseName ?? "").trim()),
    )
  ) {
    return true;
  }
  const subTab = getTrainingProgramSubTab(program, exerciseCategoryById, exerciseBank);
  if (subTab === "conditioning") return true;
  return isConditioningTrainingProgram(program, exerciseCategoryById, exerciseBank);
}

/** Medlem skal bruke intervalltimer (ikke styrke-øktmodus) for dette programmet. */
export function isMemberIntervalWorkoutProgram(
  program: Pick<TrainingProgram, "title" | "exercises" | "notes" | "conditioningDeliveryMode">,
  exerciseCategoryById: Map<string, Exercise["category"]>,
  exerciseBank: Exercise[] = [],
): boolean {
  if (isConditioningLogAfterProgram(program) || programHasConfiguredLogAfterFields(program)) {
    return false;
  }

  // Feilaktig lagret interval-markør på styrke/core skal ikke åpne intervalltimer.
  if (isConditioningIntervalProgram(program)) {
    return looksLikeDedicatedIntervalProgram(program, exerciseCategoryById, exerciseBank);
  }

  if (!hasIntervalStepStructure(program)) {
    return false;
  }

  return looksLikeDedicatedIntervalProgram(program, exerciseCategoryById, exerciseBank);
}
