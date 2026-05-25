import type { WorkoutLog } from "./types";

export type WorkoutCelebrationStats = {
  totalVolumeKg: number;
  completedSets: number;
  uniqueExercises: number;
  newRecords: string[];
  durationMinutes: number | null;
};

function parseLogStartTime(log: WorkoutLog): number | null {
  const startedAt = (log as unknown as { startedAt?: string }).startedAt;
  if (!startedAt) return null;
  const parsed = new Date(startedAt).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function parseLogFinishTime(log: WorkoutLog): number | null {
  const finishedAt = (log as unknown as { finishedAt?: string }).finishedAt;
  if (!finishedAt) return null;
  const parsed = new Date(finishedAt).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function workoutScore(weightKg: number, reps: number): number {
  return weightKg * Math.max(reps, 1);
}

/**
 * Compute stats for celebrating a single finished workout log.
 * `otherLogs` should be all OTHER completed logs by the same member, used to determine which results are new personal records.
 */
export function computeWorkoutCelebrationStats(log: WorkoutLog, otherLogs: WorkoutLog[]): WorkoutCelebrationStats {
  const results = log.results ?? [];

  const previousBestByExercise = new Map<string, number>();
  for (const other of otherLogs) {
    if (other.id === log.id) continue;
    if (other.status !== "Fullført") continue;
    for (const row of other.results ?? []) {
      if (!row.completed) continue;
      const score = workoutScore(Number(row.performedWeight) || 0, Number(row.performedReps) || 0);
      const current = previousBestByExercise.get(row.exerciseName) ?? 0;
      if (score > current) previousBestByExercise.set(row.exerciseName, score);
    }
  }

  let totalVolumeKg = 0;
  let completedSets = 0;
  const uniqueExerciseNames = new Set<string>();
  const sessionBestByExercise = new Map<string, { score: number; weight: number; reps: number }>();

  for (const row of results) {
    if (!row.completed) continue;
    const weight = Number(row.performedWeight) || 0;
    const reps = Number(row.performedReps) || 0;
    completedSets += 1;
    totalVolumeKg += weight * reps;
    uniqueExerciseNames.add(row.exerciseName);
    const score = workoutScore(weight, reps);
    const existing = sessionBestByExercise.get(row.exerciseName);
    if (!existing || score > existing.score) {
      sessionBestByExercise.set(row.exerciseName, { score, weight, reps });
    }
  }

  const newRecords: string[] = [];
  sessionBestByExercise.forEach(({ score }, name) => {
    if (score <= 0) return;
    const previousBest = previousBestByExercise.get(name) ?? 0;
    if (score > previousBest) newRecords.push(name);
  });

  let durationMinutes: number | null = null;
  const startTime = parseLogStartTime(log);
  const finishTime = parseLogFinishTime(log);
  if (startTime !== null && finishTime !== null && finishTime > startTime) {
    durationMinutes = Math.max(1, Math.round((finishTime - startTime) / 60_000));
  }

  return {
    totalVolumeKg,
    completedSets,
    uniqueExercises: uniqueExerciseNames.size,
    newRecords,
    durationMinutes,
  };
}
