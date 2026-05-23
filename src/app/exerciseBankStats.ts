import type { TrainingProgram, WorkoutLog } from "./types";

/** Antall ganger en øvelse finnes i programmer + fullførte logger. */
export function computeExercisePopularityScores(
  exercises: Array<{ id: string; name: string }>,
  programs: TrainingProgram[],
  logs: WorkoutLog[],
): Map<string, number> {
  const nameById = new Map(exercises.map((exercise) => [exercise.id, exercise.name.trim().toLowerCase()]));
  const scores = new Map<string, number>();

  for (const program of programs) {
    for (const row of program.exercises) {
      const exerciseId = row.exerciseId.trim();
      if (exerciseId) {
        scores.set(exerciseId, (scores.get(exerciseId) ?? 0) + 1);
      }
    }
  }

  for (const log of logs) {
    if (log.status !== "Fullført") continue;
    for (const result of log.results ?? []) {
      if (!result.completed) continue;
      const normalizedName = result.exerciseName.trim().toLowerCase();
      for (const [exerciseId, name] of nameById.entries()) {
        if (name === normalizedName) {
          scores.set(exerciseId, (scores.get(exerciseId) ?? 0) + 1);
        }
      }
    }
  }

  return scores;
}

export function isPopularExercise(score: number): boolean {
  return score >= 4;
}

export function isRecommendedExercise(score: number, isFavorite: boolean): boolean {
  return isFavorite || score >= 8;
}
