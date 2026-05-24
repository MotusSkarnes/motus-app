import { parseStoredLogDate } from "./dateFormat";

export type DailyWeekProgressPoint = {
  label: string;
  pct: number;
  hasSession: boolean;
};

const DAY_LABELS = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"] as const;

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function computeDailyWeekProgress(completedLogDates: Date[], nowTimestamp: number): DailyWeekProgressPoint[] {
  const today = startOfLocalDay(new Date(nowTimestamp));
  const mondayOffset = (today.getDay() + 6) % 7;
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - mondayOffset);

  const sessionDays = new Set<string>();
  for (const date of completedLogDates) {
    const day = startOfLocalDay(date);
    sessionDays.add(`${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`);
  }

  return DAY_LABELS.map((label, index) => {
    const day = new Date(monday);
    day.setDate(day.getDate() + index);
    const key = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
    const hasSession = sessionDays.has(key);
    const isFuture = day.getTime() > today.getTime();
    return {
      label,
      hasSession,
      pct: hasSession ? 100 : isFuture ? 0 : 0,
    };
  });
}

export function computeWeeklyProgressPct(points: DailyWeekProgressPoint[], nowTimestamp: number): number {
  const today = startOfLocalDay(new Date(nowTimestamp));
  const mondayOffset = (today.getDay() + 6) % 7;
  const daysElapsed = Math.min(7, mondayOffset + 1);
  const completedDays = points.filter((point) => point.hasSession).length;
  if (daysElapsed <= 0) return 0;
  return Math.min(100, Math.round((completedDays / daysElapsed) * 100));
}

export function computeWeeklyProgressDelta(completedLogDates: Date[], nowTimestamp: number): number | null {
  const today = startOfLocalDay(new Date(nowTimestamp));
  const mondayOffset = (today.getDay() + 6) % 7;
  const thisMonday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - mondayOffset);
  const lastMonday = new Date(thisMonday);
  lastMonday.setDate(lastMonday.getDate() - 7);

  const countInRange = (start: Date, days: number) => {
    const end = new Date(start);
    end.setDate(end.getDate() + days);
    let count = 0;
    for (const date of completedLogDates) {
      const day = startOfLocalDay(date);
      if (day.getTime() >= start.getTime() && day.getTime() < end.getTime()) count += 1;
    }
    return count;
  };

  const thisWeek = countInRange(thisMonday, mondayOffset + 1);
  const lastWeek = countInRange(lastMonday, 7);
  if (lastWeek <= 0 && thisWeek <= 0) return null;
  if (lastWeek <= 0) return 100;
  return Math.round(((thisWeek - lastWeek) / lastWeek) * 100);
}

export function parseCompletedLogDates(logs: Array<{ date: string; status: string }>): Date[] {
  return logs
    .filter((log) => log.status === "Fullført")
    .map((log) => parseStoredLogDate(log.date))
    .filter((date): date is Date => Boolean(date));
}
