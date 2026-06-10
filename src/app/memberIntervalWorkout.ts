import { isConditioningIntervalProgram, isConditioningLogAfterProgram } from "./conditioningProgramMode";
import type { Exercise, TrainingProgram } from "./types";
import { getTrainingProgramSubTab, isConditioningTrainingProgram } from "./trainingProgramKind";

const INTERVAL_TITLE_PATTERN = /4x4|intervall|tempo|kondisjon|mølle|moelle|tredemølle|drag/i;

const INTERVAL_EXERCISE_NAME_PATTERN = /\bdrag\b|intervall|oppvarm|nedjogg|nedtrapp|tempo|tabata|mølle|moelle/i;

function hasIntervalStepStructure(program: Pick<TrainingProgram, "exercises">): boolean {
  return program.exercises.some((exercise) => {
    const name = exercise.exerciseName.trim();
    if (INTERVAL_EXERCISE_NAME_PATTERN.test(name)) return true;
    if (Number(exercise.durationMinutes) > 0) return true;
    const holdSeconds = Number(exercise.holdSeconds) || 0;
    return holdSeconds > 0;
  });
}

/** Medlem skal bruke intervalltimer (ikke styrke-øktmodus) for dette programmet. */
export function isMemberIntervalWorkoutProgram(
  program: Pick<TrainingProgram, "title" | "exercises" | "notes" | "conditioningDeliveryMode">,
  exerciseCategoryById: Map<string, Exercise["category"]>,
  exerciseBank: Exercise[] = [],
): boolean {
  if (isConditioningLogAfterProgram(program)) {
    return false;
  }
  if (isConditioningIntervalProgram(program)) {
    return true;
  }
  const subTab = getTrainingProgramSubTab(program, exerciseCategoryById, exerciseBank);
  if (subTab === "conditioning") {
    return hasIntervalStepStructure(program);
  }
  if (isConditioningTrainingProgram(program, exerciseCategoryById, exerciseBank)) {
    return hasIntervalStepStructure(program);
  }
  const title = program.title?.trim() ?? "";
  if (INTERVAL_TITLE_PATTERN.test(title) && hasIntervalStepStructure(program)) {
    return true;
  }
  return program.exercises.some((exercise) => {
    const name = exercise.exerciseName.trim();
    if (INTERVAL_EXERCISE_NAME_PATTERN.test(name)) return true;
    if (Number(exercise.durationMinutes) > 0) return true;
    const holdSeconds = Number(exercise.holdSeconds) || 0;
    if (holdSeconds > 0 && /4x4/i.test(title)) return true;
    return false;
  });
}
