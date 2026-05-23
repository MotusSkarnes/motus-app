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

export function isRecommendedExercise(score: number, isFavorite: boolean): boolean {
  return isFavorite || score >= 8;
}

export function isPopularExercise(score: number): boolean {
  return score >= 4;
}

/** Øvelser som finnes i trener-tildelte programmer for medlemmet. */
export function computeTrainerProgramExerciseIds(programs: TrainingProgram[], memberId: string): Set<string> {
  const ids = new Set<string>();
  const scopedMemberId = memberId.trim();
  if (!scopedMemberId) return ids;

  for (const program of programs) {
    if (program.memberId !== scopedMemberId) continue;
    const fromTrainer =
      program.programCreatedBy === "trainer" || Boolean(program.assignedTrainerName?.trim());
    if (!fromTrainer) continue;
    for (const row of program.exercises) {
      const exerciseId = row.exerciseId.trim();
      if (exerciseId) ids.add(exerciseId);
    }
  }

  return ids;
}
