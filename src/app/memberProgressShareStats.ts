import { parseStoredLogDate } from "./dateFormat";
import { isHoldBasedExerciseCategory } from "./exerciseCategories";
import type { WorkoutLog } from "./types";

function getStartOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function parseLogDate(value: string): Date | null {
  return parseStoredLogDate(value);
}

export function computeShareCardLast7DaysStats(
  completedLogs: WorkoutLog[],
  nowTimestamp: number,
): { workouts: number; trainingDays: number; volumeKg: number; completedSets: number } {
  const today = getStartOfDay(new Date(nowTimestamp));
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6);

  const parseNum = (raw: string | undefined): number => {
    const n = Number(String(raw ?? "").replace(",", ".").trim());
    return Number.isFinite(n) && n > 0 ? n : 0;
  };

  let workouts = 0;
  let volumeKg = 0;
  let completedSets = 0;
  const dayKeys = new Set<string>();

  for (const log of completedLogs) {
    const d = parseLogDate(log.date);
    if (!d) continue;
    const day = getStartOfDay(d);
    if (day.getTime() < start.getTime() || day.getTime() > today.getTime()) continue;
    workouts += 1;
    dayKeys.add(day.toDateString());
    for (const result of log.results ?? []) {
      if (!result.completed) continue;
      completedSets += 1;
      if (result.exerciseCategory && isHoldBasedExerciseCategory(result.exerciseCategory)) continue;
      const durationMinutes = parseNum(result.performedDurationMinutes);
      const weight = parseNum(result.performedWeight);
      const reps = parseNum(result.performedReps);
      if (durationMinutes > 0 && weight <= 0) continue;
      if (weight > 0 && reps > 0) volumeKg += weight * reps;
    }
  }

  return {
    workouts,
    trainingDays: dayKeys.size,
    volumeKg,
    completedSets,
  };
}

/** Artig «løftevolum»-tekst for skrytekort basert på siste 7 dager. */
export function buildProgressLiftPlayfulLine(stats: {
  workouts: number;
  trainingDays: number;
  volumeKg: number;
  completedSets: number;
}): string {
  const { workouts, trainingDays, volumeKg, completedSets } = stats;
  const fmt = (n: number) => Math.round(n).toLocaleString("nb-NO");

  const lineFor = (kg: number): string | null => {
    if (!Number.isFinite(kg) || kg < 1) return null;
    if (kg >= 5500) {
      return `Siste 7 dager har jeg løftet ca. ${fmt(kg)} kg totalt - omtrent som en flodhest`;
    }
    if (kg >= 3200) {
      return `Siste 7 dager har jeg flyttet ca. ${fmt(kg)} kg - omtrent som en liten bil`;
    }
    if (kg >= 1600) {
      return `Siste 7 dager har jeg logget ca. ${fmt(kg)} kg - omtrent som flere flygel`;
    }
    if (kg >= 700) {
      return `Siste 7 dager har jeg løftet ca. ${fmt(kg)} kg - omtrent som flere voksne til sammen`;
    }
    if (kg >= 250) {
      const people = Math.max(2, Math.round(kg / 72));
      return `Siste 7 dager har jeg samlet ca. ${fmt(kg)} kg - omtrent som ${people} voksne til sammen`;
    }
    if (kg >= 60) {
      const melons = Math.max(6, Math.round(kg / 8));
      return `Siste 7 dager ble det ca. ${fmt(kg)} kg for meg - omtrent som ${melons} store vannmeloner`;
    }
    if (kg >= 15) {
      return `Siste 7 dager har jeg logget ca. ${fmt(kg)} kg i vekt x reps - litt etter litt bygger det seg opp`;
    }
    return `Siste 7 dager har jeg logget ca. ${fmt(kg)} kg i vekt x reps`;
  };

  const weekLine = lineFor(volumeKg);
  if (weekLine) return weekLine;

  if (completedSets >= 24) {
    return `Siste 7 dager fullførte jeg ${completedSets} sett fordelt på ${workouts} økter`;
  }
  if (workouts >= 4 && trainingDays >= 4) {
    return `Siste 7 dager trente jeg ${workouts} økter fordelt på ${trainingDays} treningsdager`;
  }
  if (workouts >= 3) {
    return `Siste 7 dager holdt jeg flyten med ${workouts} økter og ${completedSets} fullførte sett`;
  }
  if (trainingDays >= 2) {
    return `Siste 7 dager fikk jeg inn ${trainingDays} treningsdager - nå bygger jeg videre`;
  }
  if (workouts >= 1) {
    return `Siste 7 dager fikk jeg inn ${workouts} økt og ${completedSets} sett på veien`;
  }
  return "Siste 7 dager har jeg startet uka mi i riktig retning";
}
