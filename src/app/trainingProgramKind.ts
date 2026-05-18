import type { Exercise, TrainingProgram } from "./types";

export type ProgramsSubTab = "strength" | "conditioning";

export type ExerciseBankSubTab = ProgramsSubTab;

export function exerciseMatchesBankSubTab(category: Exercise["category"], subTab: ExerciseBankSubTab): boolean {
  if (subTab === "conditioning") return category === "Kondisjon";
  return category === "Styrke" || category === "Uttøyning";
}

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

export function isStrengthTrainingProgram(
  program: Pick<TrainingProgram, "exercises">,
  exerciseCategoryById: Map<string, Exercise["category"]>,
): boolean {
  return !isConditioningTrainingProgram(program, exerciseCategoryById);
}

export function filterTemplateProgramsBySubTab(
  programs: TrainingProgram[],
  subTab: ProgramsSubTab,
  exerciseCategoryById: Map<string, Exercise["category"]>,
): TrainingProgram[] {
  return programs.filter((program) =>
    subTab === "conditioning"
      ? isConditioningTrainingProgram(program, exerciseCategoryById)
      : isStrengthTrainingProgram(program, exerciseCategoryById),
  );
}
