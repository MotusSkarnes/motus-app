import { parseStoredLogDate } from "./dateFormat";
import { getWeekKey } from "./memberProgressGamification";
import { parseLogDateMs } from "./workoutLogDate";
import type { WorkoutLog } from "./types";

export type HistoryPeriodWeeks = 4 | 12 | 26;

export type HistoryPeriodStats = {
  workouts: number;
  trainingMinutes: number;
  estimatedKcal: number;
  personalRecords: number;
  workoutsDelta: number;
  trainingMinutesDelta: number;
  estimatedKcalDelta: number;
  personalRecordsDelta: number;
};

export type WeeklyWorkoutBar = {
  weekKey: string;
  label: string;
  count: number;
};

export type ConsistencyHeatmapCell = {
  dateKey: string;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
};

export type ConsistencyHeatmapMonth = {
  label: string;
  cells: Array<ConsistencyHeatmapCell | null>;
};

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function parseLogDay(log: WorkoutLog): Date | null {
  const ms = parseLogDateMs(log.date);
  if (ms) return startOfLocalDay(new Date(ms));
  const parsed = parseStoredLogDate(log.date);
  return parsed ? startOfLocalDay(parsed) : null;
}

function estimateLogTrainingMinutes(log: WorkoutLog): number {
  let minutes = 0;
  for (const result of log.results ?? []) {
    if (!result.completed) continue;
    const performed = Number(String(result.performedDurationMinutes ?? "").replace(",", "."));
    if (Number.isFinite(performed) && performed > 0) {
      minutes += performed;
      continue;
    }
    minutes += 2.5;
  }
  return Math.max(minutes > 0 ? Math.round(minutes) : 0, log.results?.some((r) => r.completed) ? 35 : 45);
}

function estimateLogKcal(log: WorkoutLog, trainingMinutes: number): number {
  const completedSets = (log.results ?? []).filter((result) => result.completed).length;
  return Math.round(completedSets * 6 + trainingMinutes * 7.5);
}

function countPersonalRecordsInRange(logs: WorkoutLog[], rangeStart: Date, rangeEnd: Date): number {
  const bestByExercise = new Map<string, number>();
  let count = 0;

  const sorted = [...logs]
    .filter((log) => log.status === "Fullført")
    .sort((a, b) => (parseLogDay(a)?.getTime() ?? 0) - (parseLogDay(b)?.getTime() ?? 0));

  for (const log of sorted) {
    const day = parseLogDay(log);
    if (!day) continue;
    if (day.getTime() < rangeStart.getTime() || day.getTime() > rangeEnd.getTime()) continue;

    for (const result of log.results ?? []) {
      if (!result.completed) continue;
      const weight = Number(result.performedWeight) || 0;
      const reps = Number(result.performedReps) || 0;
      const score = weight * Math.max(reps, 1);
      if (score <= 0) continue;
      const previous = bestByExercise.get(result.exerciseName) ?? 0;
      if (score > previous) {
        bestByExercise.set(result.exerciseName, score);
        count += 1;
      }
    }
  }

  return count;
}

function aggregatePeriod(
  logs: WorkoutLog[],
  rangeStart: Date,
  rangeEnd: Date,
): Pick<HistoryPeriodStats, "workouts" | "trainingMinutes" | "estimatedKcal" | "personalRecords"> {
  let workouts = 0;
  let trainingMinutes = 0;
  let estimatedKcal = 0;

  for (const log of logs) {
    if (log.status !== "Fullført") continue;
    const day = parseLogDay(log);
    if (!day) continue;
    if (day.getTime() < rangeStart.getTime() || day.getTime() > rangeEnd.getTime()) continue;
    workouts += 1;
    const minutes = estimateLogTrainingMinutes(log);
    trainingMinutes += minutes;
    estimatedKcal += estimateLogKcal(log, minutes);
  }

  return {
    workouts,
    trainingMinutes,
    estimatedKcal,
    personalRecords: countPersonalRecordsInRange(logs, rangeStart, rangeEnd),
  };
}

export function computeHistoryPeriodStats(
  logs: WorkoutLog[],
  periodWeeks: HistoryPeriodWeeks,
  nowTimestamp: number,
): HistoryPeriodStats {
  const today = startOfLocalDay(new Date(nowTimestamp));
  const currentStart = new Date(today);
  currentStart.setDate(currentStart.getDate() - periodWeeks * 7 + 1);
  const previousStart = new Date(currentStart);
  previousStart.setDate(previousStart.getDate() - periodWeeks * 7);
  const previousEnd = new Date(currentStart);
  previousEnd.setDate(previousEnd.getDate() - 1);

  const current = aggregatePeriod(logs, currentStart, today);
  const previous = aggregatePeriod(logs, previousStart, previousEnd);

  return {
    ...current,
    workoutsDelta: current.workouts - previous.workouts,
    trainingMinutesDelta: current.trainingMinutes - previous.trainingMinutes,
    estimatedKcalDelta: current.estimatedKcal - previous.estimatedKcal,
    personalRecordsDelta: current.personalRecords - previous.personalRecords,
  };
}

export function formatTrainingDuration(totalMinutes: number): string {
  if (totalMinutes <= 0) return "0 min";
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes} min`;
  if (minutes <= 0) return `${hours} t`;
  return `${hours} t ${minutes} m`;
}

export function formatDeltaLabel(value: number, unit: string): string {
  if (value === 0) return `0 ${unit} fra forrige periode`;
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toLocaleString("nb-NO")} ${unit} fra forrige periode`;
}

export function computeWeeklyWorkoutBars(logs: WorkoutLog[], weekCount: number, nowTimestamp: number): WeeklyWorkoutBar[] {
  const today = startOfLocalDay(new Date(nowTimestamp));
  const mondayOffset = (today.getDay() + 6) % 7;
  const currentMonday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - mondayOffset);

  const bars: WeeklyWorkoutBar[] = [];
  for (let index = weekCount - 1; index >= 0; index -= 1) {
    const weekStart = new Date(currentMonday);
    weekStart.setDate(weekStart.getDate() - index * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const weekKey = getWeekKey(weekStart);
    const weekNumber = Number(weekKey.split("-")[1] || 0);
    let count = 0;
    for (const log of logs) {
      if (log.status !== "Fullført") continue;
      const day = parseLogDay(log);
      if (!day) continue;
      if (day.getTime() >= weekStart.getTime() && day.getTime() < weekEnd.getTime()) count += 1;
    }
    bars.push({
      weekKey,
      label: `Uke ${weekNumber}`,
      count,
    });
  }
  return bars;
}

export function computeWeeklyAverageInsight(currentBars: WeeklyWorkoutBar[], previousBars: WeeklyWorkoutBar[]): string | null {
  const currentAvg =
    currentBars.length > 0 ? currentBars.reduce((sum, bar) => sum + bar.count, 0) / currentBars.length : 0;
  const previousAvg =
    previousBars.length > 0 ? previousBars.reduce((sum, bar) => sum + bar.count, 0) / previousBars.length : 0;
  if (currentAvg <= 0 && previousAvg <= 0) return null;
  if (previousAvg <= 0) return "Du har kommet i gang med jevn aktivitet denne perioden.";
  const deltaPct = Math.round(((currentAvg - previousAvg) / previousAvg) * 100);
  if (deltaPct === 0) return "Du ligger på snittet ditt fra forrige periode.";
  if (deltaPct > 0) return `Du er ${deltaPct}% over snittet ditt fra forrige periode.`;
  return `Du er ${Math.abs(deltaPct)}% under snittet ditt fra forrige periode – små steg teller fortsatt.`;
}

export function computeConsistencyHeatmap(
  logs: WorkoutLog[],
  monthCount: number,
  nowTimestamp: number,
): ConsistencyHeatmapMonth[] {
  const today = startOfLocalDay(new Date(nowTimestamp));
  const months: ConsistencyHeatmapMonth[] = [];

  for (let offset = monthCount - 1; offset >= 0; offset -= 1) {
    const monthDate = new Date(today.getFullYear(), today.getMonth() - offset, 1);
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const countsByDay = new Map<number, number>();

    for (const log of logs) {
      if (log.status !== "Fullført") continue;
      const day = parseLogDay(log);
      if (!day || day.getMonth() !== month || day.getFullYear() !== year) continue;
      const dayNumber = day.getDate();
      countsByDay.set(dayNumber, (countsByDay.get(dayNumber) ?? 0) + 1);
    }

    const maxCount = Math.max(0, ...Array.from(countsByDay.values()));
    const firstDay = new Date(year, month, 1);
    const monthOffset = (firstDay.getDay() + 6) % 7;
    const cells: Array<ConsistencyHeatmapCell | null> = [];

    for (let index = 0; index < monthOffset; index += 1) cells.push(null);
    for (let day = 1; day <= daysInMonth; day += 1) {
      const count = countsByDay.get(day) ?? 0;
      let level: ConsistencyHeatmapCell["level"] = 0;
      if (count > 0 && maxCount > 0) {
        const ratio = count / maxCount;
        if (ratio >= 0.85) level = 4;
        else if (ratio >= 0.6) level = 3;
        else if (ratio >= 0.35) level = 2;
        else level = 1;
      }
      cells.push({
        dateKey: `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
        count,
        level,
      });
    }

    months.push({
      label: monthDate.toLocaleDateString("no-NO", { month: "long" }),
      cells,
    });
  }

  return months;
}

export function topLoggedExercises(
  logs: WorkoutLog[],
  limit = 8,
): Array<{ name: string; sessions: number; sets: number }> {
  const byName = new Map<string, { sessions: number; sets: number }>();
  for (const log of logs) {
    if (log.status !== "Fullført") continue;
    const seenInSession = new Set<string>();
    for (const result of log.results ?? []) {
      if (!result.completed) continue;
      const name = result.exerciseName.trim();
      if (!name) continue;
      const current = byName.get(name) ?? { sessions: 0, sets: 0 };
      current.sets += 1;
      if (!seenInSession.has(name)) {
        current.sessions += 1;
        seenInSession.add(name);
      }
      byName.set(name, current);
    }
  }
  return Array.from(byName.entries())
    .map(([name, stats]) => ({ name, ...stats }))
    .sort((a, b) => b.sessions - a.sessions || b.sets - a.sets)
    .slice(0, limit);
}

export function estimateLogTrainingMinutesForDisplay(log: WorkoutLog): number {
  return estimateLogTrainingMinutes(log);
}

export function countCompletedExercises(log: WorkoutLog): number {
  return new Set(
    (log.results ?? [])
      .filter((result) => result.completed)
      .map((result) => result.exerciseName.trim())
      .filter(Boolean),
  ).size;
}
