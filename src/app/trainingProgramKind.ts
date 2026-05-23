import { isLegacyIntervalCooldownDrag } from "./programBlocks";
import type { Exercise, ProgramExercise, TrainingProgram } from "./types";
import {
  exerciseMatchesExerciseBankTab,
  subTabForExerciseCategory,
  type ExerciseBankSubTab,
  type ProgramsSubTab,
  type TrainingSubTab,
} from "./exerciseCategories";

export type { ExerciseBankSubTab, ProgramsSubTab, TrainingSubTab };

export function buildExerciseCategoryById(exercises: Exercise[]): Map<string, Exercise["category"]> {
  const byId = new Map<string, Exercise["category"]>();
  exercises.forEach((exercise) => {
    byId.set(exercise.id, exercise.category);
  });
  return byId;
}

function isIntervalAuxiliaryStep(exercise: ProgramExercise, exercises: ProgramExercise[], index: number): boolean {
  const lower = exercise.exerciseName.trim().toLowerCase();
  if (lower.includes("oppvarm")) return true;
  if (lower.includes("nedjogg")) return true;
  if (isLegacyIntervalCooldownDrag(exercises, index)) return true;
  return false;
}

function primaryProgramExercises(program: Pick<TrainingProgram, "exercises">): ProgramExercise[] {
  const filtered = program.exercises.filter((exercise, index) => !isIntervalAuxiliaryStep(exercise, program.exercises, index));
  return filtered.length > 0 ? filtered : program.exercises;
}

export function resolveProgramExerciseCategory(
  exercise: ProgramExercise,
  exerciseBank: Exercise[],
  exerciseCategoryById: Map<string, Exercise["category"]>,
): Exercise["category"] {
  const fromId = exerciseCategoryById.get(exercise.exerciseId);
  if (fromId) return fromId;

  const normalizedName = exercise.exerciseName.trim().toLowerCase();
  const byName = exerciseBank.find((item) => item.name.trim().toLowerCase() === normalizedName);
  if (byName) return byName.category;

  if (Number(exercise.durationMinutes) > 0) return "Kondisjon";

  const holdSeconds = String(exercise.holdSeconds ?? "").trim();
  if (holdSeconds) return "Mobilitet";

  return "Styrke";
}

function resolvedProgramExerciseCategories(
  program: Pick<TrainingProgram, "exercises">,
  exerciseBank: Exercise[],
  exerciseCategoryById: Map<string, Exercise["category"]>,
): Exercise["category"][] {
  return primaryProgramExercises(program).map((exercise) =>
    resolveProgramExerciseCategory(exercise, exerciseBank, exerciseCategoryById),
  );
}

/** Intervall/kondisjon: primærsteg med varighet, eller alle Kondisjon med minutter. */
export function isConditioningTrainingProgram(
  program: Pick<TrainingProgram, "exercises">,
  exerciseCategoryById: Map<string, Exercise["category"]>,
  exerciseBank: Exercise[] = [],
): boolean {
  if (program.exercises.length === 0) return false;

  const steps = primaryProgramExercises(program);
  const timedSteps = steps.filter((exercise) => Number(exercise.durationMinutes) > 0);
  if (timedSteps.length > 0 && timedSteps.length === steps.length) return true;

  return steps.every((exercise) => {
    const category = resolveProgramExerciseCategory(exercise, exerciseBank, exerciseCategoryById);
    const hasTimedStep = Number(exercise.durationMinutes) > 0;
    return category === "Kondisjon" && hasTimedStep;
  });
}

export function getTrainingProgramSubTab(
  program: Pick<TrainingProgram, "exercises">,
  exerciseCategoryById: Map<string, Exercise["category"]>,
  exerciseBank: Exercise[] = [],
): TrainingSubTab {
  if (program.exercises.length === 0) return "strength";
  if (isConditioningTrainingProgram(program, exerciseCategoryById, exerciseBank)) return "conditioning";

  const categories = resolvedProgramExerciseCategories(program, exerciseBank, exerciseCategoryById);
  if (categories.every((category) => category === "Rehab")) return "rehab";
  if (categories.every((category) => category === "Mobilitet" || category === "Uttøyning")) {
    return "mobility";
  }
  if (categories.every((category) => category === "Styrke")) return "strength";
  if (categories.every((category) => category === "Kondisjon")) return "conditioning";

  const counts: Record<TrainingSubTab, number> = {
    strength: 0,
    conditioning: 0,
    mobility: 0,
    rehab: 0,
  };
  categories.forEach((category) => {
    counts[subTabForExerciseCategory(category)] += 1;
  });
  return (Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "strength") as TrainingSubTab;
}

export function trainingProgramCategoryLabel(
  program: Pick<TrainingProgram, "exercises">,
  exerciseCategoryById: Map<string, Exercise["category"]>,
  exerciseBank: Exercise[] = [],
): string {
  switch (getTrainingProgramSubTab(program, exerciseCategoryById, exerciseBank)) {
    case "conditioning":
      return "Kondisjon";
    case "mobility":
      return "Mobilitet";
    case "rehab":
      return "Rehab";
    default:
      return "Styrke";
  }
}

export function trainingProgramMatchesSubTab(
  program: Pick<TrainingProgram, "exercises">,
  subTab: TrainingSubTab,
  exerciseCategoryById: Map<string, Exercise["category"]>,
  exerciseBank: Exercise[] = [],
): boolean {
  return getTrainingProgramSubTab(program, exerciseCategoryById, exerciseBank) === subTab;
}

export function filterTemplateProgramsBySubTab(
  programs: TrainingProgram[],
  subTab: TrainingSubTab,
  exerciseCategoryById: Map<string, Exercise["category"]>,
  exerciseBank: Exercise[] = [],
): TrainingProgram[] {
  return programs.filter((program) => trainingProgramMatchesSubTab(program, subTab, exerciseCategoryById, exerciseBank));
}

/** @deprecated Bruk exerciseMatchesExerciseBankTab */
export function exerciseMatchesBankSubTab(category: Exercise["category"], subTab: ExerciseBankSubTab): boolean {
  return exerciseMatchesExerciseBankTab(category, subTab);
}
