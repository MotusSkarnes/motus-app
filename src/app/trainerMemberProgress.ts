import {
  computeConsistencyHeatmap,
  computeHistoryPeriodStats,
  computeWeeklyWorkoutBars,
  formatTrainingDuration,
  type ConsistencyHeatmapMonth,
  type HistoryPeriodStats,
  type HistoryPeriodWeeks,
  type WeeklyWorkoutBar,
} from "./memberTrainingHistory";
import { parseLogDateMs } from "./workoutLogDate";
import { computeStreakWeeks, getWeekKey } from "./memberProgressGamification";
import { buildExerciseStrengthHistory, type StrengthHistoryPoint } from "./personalRecordProgress";
import { resolvePersonalRecordKind, type PersonalRecordKind } from "./personalRecordScore";
import { resolveWorkoutLoadUnit } from "./workoutResultUnits";
import type { Exercise, WorkoutLog } from "./types";

export type TrainerMemberStrengthLift = {
  name: string;
  kind: PersonalRecordKind;
  currentLabel: string;
  currentValue: number;
  deltaValue: number | null;
  deltaLabel: string;
  sessions: number;
  history: StrengthHistoryPoint[];
};

export type TrainerMemberProgressSnapshot = {
  periodWeeks: HistoryPeriodWeeks;
  periodStats: HistoryPeriodStats;
  averageSessionsPerWeek: number;
  previousAverageSessionsPerWeek: number;
  weeklyBars: WeeklyWorkoutBar[];
  weeklyInsight: string | null;
  streakWeeks: number;
  heatmapMonths: ConsistencyHeatmapMonth[];
  strengthLifts: TrainerMemberStrengthLift[];
  trainingTimeLabel: string;
};

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatSigned(value: number, unit: string): string {
  const rounded = Math.round(value * 10) / 10;
  if (rounded === 0) return `0 ${unit}`;
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${rounded.toLocaleString("nb-NO")} ${unit}`;
}

function averageFromBars(bars: WeeklyWorkoutBar[]): number {
  if (!bars.length) return 0;
  return bars.reduce((sum, bar) => sum + bar.count, 0) / bars.length;
}

export function computeTrainerWeeklyInsight(
  currentAvg: number,
  previousAvg: number,
): string | null {
  if (currentAvg <= 0 && previousAvg <= 0) return null;
  if (previousAvg <= 0) return "Kunden har kommet i gang med jevn aktivitet denne perioden.";
  const deltaPct = Math.round(((currentAvg - previousAvg) / previousAvg) * 100);
  if (deltaPct === 0) return "Økter per uke ligger på samme nivå som forrige periode.";
  if (deltaPct > 0) return `${deltaPct} % flere økter per uke enn forrige periode.`;
  return `${Math.abs(deltaPct)} % færre økter per uke enn forrige periode.`;
}

function liftKindForExercise(logs: WorkoutLog[], name: string, exercises: Exercise[]): PersonalRecordKind {
  const linked = exercises.find((exercise) => exercise.name.trim().toLowerCase() === name.trim().toLowerCase());
  for (const log of logs) {
    if (log.status !== "Fullført") continue;
    for (const result of log.results ?? []) {
      if (!result.completed) continue;
      if (result.exerciseName.trim().toLowerCase() !== name.trim().toLowerCase()) continue;
      const kind = resolvePersonalRecordKind(result, linked);
      if (kind) return kind;
    }
  }
  return "oneRm";
}

function currentLiftLabel(kind: PersonalRecordKind, point: StrengthHistoryPoint | undefined): string {
  if (!point) return "—";
  if (kind === "seconds") return `${point.estimated1RmKg} sek`;
  if (kind === "reps") return `${point.estimated1RmKg} reps`;
  return point.bestSetLabel || `${point.estimated1RmKg} kg 1RM`;
}

function unitForKind(kind: PersonalRecordKind): string {
  if (kind === "seconds") return "sek";
  if (kind === "reps") return "reps";
  return "kg";
}

export function buildTrainerMemberStrengthLifts(
  logs: WorkoutLog[],
  exercises: Exercise[],
  limit = 6,
): TrainerMemberStrengthLift[] {
  const counts = new Map<string, number>();
  for (const log of logs) {
    if (log.status !== "Fullført") continue;
    const seen = new Set<string>();
    for (const result of log.results ?? []) {
      if (!result.completed) continue;
      const name = result.exerciseName.trim();
      if (!name) continue;
      if (resolveWorkoutLoadUnit(result) === "sec" && !resolvePersonalRecordKind(result, undefined)) continue;
      if (seen.has(name.toLowerCase())) continue;
      seen.add(name.toLowerCase());
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "nb"))
    .slice(0, Math.max(limit * 2, 12))
    .map(([name, sessions]) => {
      const kind = liftKindForExercise(logs, name, exercises);
      const history = buildExerciseStrengthHistory(logs, name, kind);
      const first = history[0];
      const latest = history[history.length - 1];
      const deltaValue =
        first && latest && history.length > 1
          ? Math.round((latest.estimated1RmKg - first.estimated1RmKg) * 10) / 10
          : null;
      return {
        name,
        kind,
        currentLabel: currentLiftLabel(kind, latest),
        currentValue: latest?.estimated1RmKg ?? 0,
        deltaValue,
        deltaLabel: deltaValue === null ? "For lite data" : formatSigned(deltaValue, unitForKind(kind)),
        sessions,
        history,
      };
    })
    .filter((lift) => lift.history.length > 0)
    .sort((a, b) => {
      const aDelta = Math.abs(a.deltaValue ?? 0);
      const bDelta = Math.abs(b.deltaValue ?? 0);
      return bDelta - aDelta || b.sessions - a.sessions;
    })
    .slice(0, limit);
}

export function buildTrainerMemberProgressSnapshot(input: {
  logs: WorkoutLog[];
  exercises: Exercise[];
  periodWeeks: HistoryPeriodWeeks;
  nowTimestamp?: number;
}): TrainerMemberProgressSnapshot {
  const nowTimestamp = input.nowTimestamp ?? Date.now();
  const completedLogs = input.logs.filter((log) => log.status === "Fullført");
  const periodStats = computeHistoryPeriodStats(completedLogs, input.periodWeeks, nowTimestamp);
  const weeklyBars = computeWeeklyWorkoutBars(completedLogs, input.periodWeeks, nowTimestamp);
  const previousBars = computeWeeklyWorkoutBars(
    completedLogs,
    input.periodWeeks * 2,
    nowTimestamp,
  ).slice(0, input.periodWeeks);
  const averageSessionsPerWeek = Math.round(averageFromBars(weeklyBars) * 10) / 10;
  const previousAverageSessionsPerWeek = Math.round(averageFromBars(previousBars) * 10) / 10;
  const trainingWeekKeys = Array.from(
    new Set(
      completedLogs
        .map((log) => {
          const ms = parseLogDateMs(log.date);
          return ms > 0 ? getWeekKey(startOfLocalDay(new Date(ms))) : "";
        })
        .filter(Boolean),
    ),
  ).sort().reverse();

  return {
    periodWeeks: input.periodWeeks,
    periodStats,
    averageSessionsPerWeek,
    previousAverageSessionsPerWeek,
    weeklyBars,
    weeklyInsight: computeTrainerWeeklyInsight(averageSessionsPerWeek, previousAverageSessionsPerWeek),
    streakWeeks: computeStreakWeeks(trainingWeekKeys),
    heatmapMonths: computeConsistencyHeatmap(completedLogs, 4, nowTimestamp),
    strengthLifts: buildTrainerMemberStrengthLifts(completedLogs, input.exercises),
    trainingTimeLabel: formatTrainingDuration(periodStats.trainingMinutes),
  };
}
