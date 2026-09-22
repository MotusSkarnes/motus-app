import type { WorkoutLog } from "./types";
import { personalRecordMapKey, personalRecordScore, resolvePersonalRecordKind } from "./personalRecordScore";
import { isKgBasedWorkoutResult } from "./workoutResultUnits";
import { parseLogDateMs } from "./workoutLogDate";

export type WorkoutCelebrationStats = {
  isConditioning: boolean;
  conditioningResults: Array<{ exerciseName: string; values: Array<{ label: string; value: string; previous?: string }> }>;
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

/**
 * Compute stats for celebrating a single finished workout log.
 * `otherLogs` should be all OTHER completed logs by the same member, used to determine which results are new personal records.
 */
export function computeWorkoutCelebrationStats(log: WorkoutLog, otherLogs: WorkoutLog[]): WorkoutCelebrationStats {
  const results = log.results ?? [];
  const completedResults = results.filter((row) => row.completed);
  const isConditioning = completedResults.length > 0 && completedResults.every(
    (row) => row.exerciseCategory === "Kondisjon" || Boolean(row.logFieldKeys?.some((key) =>
      ["distance", "heartRate", "speed", "incline", "minutes"].includes(key))),
  );
  const conditioningFields = [
    ["performedDistanceKm", "Distanse", "km"],
    ["performedDurationMinutes", "Tid", "min"],
    ["performedHeartRate", "Puls", "slag/min"],
    ["performedSpeed", "Fart", "km/t"],
    ["performedIncline", "Stigning", "%"],
    ["performedCustom1", "Egendefinert 1", ""],
    ["performedCustom2", "Egendefinert 2", ""],
  ] as const;
  const conditioningResults = isConditioning ? completedResults.map((row) => {
    const currentDate = parseLogDateMs(log.date);
    const previous = otherLogs.filter((other) => other.id !== log.id && other.status === "Fullført" &&
      other.memberId === log.memberId && (!currentDate || parseLogDateMs(other.date) <= currentDate) &&
      other.results?.some((candidate) => candidate.completed &&
        candidate.exerciseName.trim().toLowerCase() === row.exerciseName.trim().toLowerCase()))
      .sort((a, b) => parseLogDateMs(b.date) - parseLogDateMs(a.date))[0];
    const previousRow = previous?.results?.find((candidate) =>
      candidate.completed && candidate.exerciseName.trim().toLowerCase() === row.exerciseName.trim().toLowerCase());
    return {
      exerciseName: row.exerciseName,
      values: conditioningFields.flatMap(([key, label, unit]) => {
        const value = row[key]?.trim();
        if (!value) return [];
        const previousValue = previousRow?.[key]?.trim();
        return [{ label: key === "performedCustom1" ? row.customField1Label?.trim() || label
          : key === "performedCustom2" ? row.customField2Label?.trim() || label : label,
          value: `${value}${unit ? ` ${unit}` : ""}`,
          ...(previousValue ? { previous: `${previousValue}${unit ? ` ${unit}` : ""}` } : {}) }];
      }),
    };
  }).filter((row) => row.values.length > 0) : [];

  const previousBestByKey = new Map<string, number>();
  for (const other of otherLogs) {
    if (other.id === log.id) continue;
    if (other.status !== "Fullført") continue;
    for (const row of other.results ?? []) {
      if (!row.completed) continue;
      const kind = resolvePersonalRecordKind(row);
      if (!kind) continue;
      const score = personalRecordScore(row, kind);
      if (score <= 0) continue;
      const key = personalRecordMapKey(row.exerciseName, kind);
      const current = previousBestByKey.get(key) ?? 0;
      if (score > current) previousBestByKey.set(key, score);
    }
  }

  let totalVolumeKg = 0;
  let completedSets = 0;
  const uniqueExerciseNames = new Set<string>();
  const sessionBestByKey = new Map<string, { score: number; name: string }>();

  for (const row of results) {
    if (!row.completed) continue;
    completedSets += 1;
    uniqueExerciseNames.add(row.exerciseName);
    if (isKgBasedWorkoutResult(row)) {
      const weight = Number(row.performedWeight) || 0;
      const reps = Number(row.performedReps) || 0;
      totalVolumeKg += weight * reps;
    }
    const kind = resolvePersonalRecordKind(row);
    if (!kind) continue;
    const score = personalRecordScore(row, kind);
    if (score <= 0) continue;
    const key = personalRecordMapKey(row.exerciseName, kind);
    const existing = sessionBestByKey.get(key);
    if (!existing || score > existing.score) {
      sessionBestByKey.set(key, { score, name: row.exerciseName });
    }
  }

  const newRecords: string[] = [];
  sessionBestByKey.forEach(({ score, name }, key) => {
    if (score <= 0) return;
    const previousBest = previousBestByKey.get(key) ?? 0;
    if (score > previousBest) newRecords.push(name);
  });

  let durationMinutes: number | null = null;
  const startTime = parseLogStartTime(log);
  const finishTime = parseLogFinishTime(log);
  if (startTime !== null && finishTime !== null && finishTime > startTime) {
    durationMinutes = Math.max(1, Math.round((finishTime - startTime) / 60_000));
  }

  return {
    isConditioning,
    conditioningResults,
    totalVolumeKg,
    completedSets,
    uniqueExercises: uniqueExerciseNames.size,
    newRecords,
    durationMinutes,
  };
}
