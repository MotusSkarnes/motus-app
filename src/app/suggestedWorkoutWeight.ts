import { parseLogDateMs } from "./workoutLogDate";
import { isKgBasedWorkoutResult, isSecondsBasedWorkoutResult } from "./workoutResultUnits";
import type { WorkoutLog } from "./types";

function parsePerformedLoad(value: string | number | undefined): number {
  const parsed = Number(String(value ?? "").trim().replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function formatLoadValue(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return String(Math.round(value * 10) / 10);
}

/**
 * Foreslått belastning fra forrige gang øvelsen ble gjort:
 * høyeste utført vekt (kg) eller hold (sek) i den økten.
 */
export function findMaxPerformedLoadFromLastExerciseSession(
  logs: WorkoutLog[],
  exerciseName: string,
): string {
  const normalized = exerciseName.trim().toLowerCase();
  if (!normalized) return "";

  const sorted = [...logs]
    .filter((log) => log.status === "Fullført")
    .sort((a, b) => (parseLogDateMs(b.date) || 0) - (parseLogDateMs(a.date) || 0));

  for (const log of sorted) {
    let maxKg = 0;
    let maxSec = 0;
    let foundKg = false;
    let foundSec = false;

    for (const result of log.results ?? []) {
      if (!result.completed) continue;
      if (result.exerciseName.trim().toLowerCase() !== normalized) continue;

      if (isKgBasedWorkoutResult(result)) {
        const weight = parsePerformedLoad(result.performedWeight);
        if (weight <= 0) continue;
        foundKg = true;
        maxKg = Math.max(maxKg, weight);
        continue;
      }

      if (isSecondsBasedWorkoutResult(result)) {
        const seconds = parsePerformedLoad(result.performedWeight);
        if (seconds <= 0) continue;
        foundSec = true;
        maxSec = Math.max(maxSec, seconds);
      }
    }

    if (foundKg) return formatLoadValue(maxKg);
    if (foundSec) return formatLoadValue(maxSec);
  }

  return "";
}
