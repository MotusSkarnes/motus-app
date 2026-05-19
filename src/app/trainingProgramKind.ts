import type { Exercise, TrainingProgram } from "./types";
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

/** Intervall/kondisjon: alle steg er Kondisjon med varighet i minutter. */
export function isConditioningTrainingProgram(
  program: Pick<TrainingProgram, "exercises">,
  exerciseCategoryById: Map<string, Exercise["category"]>,
): boolean {
  if (program.exercises.length === 0) return false;
  return program.exercises.every((exercise) => {
    const category = exerciseCategoryById.get(exercise.exerciseId);
    const hasTimedStep = Number(exercise.durationMinutes) > 0;
    return category === "Kondisjon" && hasTimedStep;
  });
}

export function getTrainingProgramSubTab(
  program: Pick<TrainingProgram, "exercises">,
  exerciseCategoryById: Map<string, Exercise["category"]>,
): TrainingSubTab {
  if (program.exercises.length === 0) return "strength";
  if (isConditioningTrainingProgram(program, exerciseCategoryById)) return "conditioning";

  const categories = program.exercises.map(
    (exercise) => exerciseCategoryById.get(exercise.exerciseId) ?? "Styrke",
  );
  if (categories.every((category) => category === "Rehab")) return "rehab";
  if (categories.every((category) => category === "Mobilitet" || category === "Uttøyning")) {
    return "mobility";
  }
  if (categories.every((category) => category === "Styrke")) return "strength";

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

export function trainingProgramMatchesSubTab(
  program: Pick<TrainingProgram, "exercises">,
  subTab: TrainingSubTab,
  exerciseCategoryById: Map<string, Exercise["category"]>,
): boolean {
  return getTrainingProgramSubTab(program, exerciseCategoryById) === subTab;
}

export function filterTemplateProgramsBySubTab(
  programs: TrainingProgram[],
  subTab: TrainingSubTab,
  exerciseCategoryById: Map<string, Exercise["category"]>,
): TrainingProgram[] {
  return programs.filter((program) => trainingProgramMatchesSubTab(program, subTab, exerciseCategoryById));
}

/** @deprecated Bruk exerciseMatchesExerciseBankTab */
export function exerciseMatchesBankSubTab(category: Exercise["category"], subTab: ExerciseBankSubTab): boolean {
  return exerciseMatchesExerciseBankTab(category, subTab);
}
