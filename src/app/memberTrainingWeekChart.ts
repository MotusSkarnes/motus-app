import { parseStoredLogDate } from "./dateFormat";

export type DailyWeekProgressPoint = {
  label: string;
  pct: number;
  hasSession: boolean;
};

const DAY_LABELS_BY_DAY = ["Søn", "Man", "Tir", "Ons", "Tor", "Fre", "Lør"] as const;

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function computeDailyWeekProgress(completedLogDates: Date[], nowTimestamp: number): DailyWeekProgressPoint[] {
  const today = startOfLocalDay(new Date(nowTimestamp));
  const startDay = new Date(today);
  startDay.setDate(today.getDate() - 6);

  const sessionDays = new Set<string>();
  for (const date of completedLogDates) {
    sessionDays.add(dayKey(startOfLocalDay(date)));
  }

  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(startDay);
    day.setDate(startDay.getDate() + index);
    const hasSession = sessionDays.has(dayKey(day));
    return {
      label: DAY_LABELS_BY_DAY[day.getDay()],
      hasSession,
      pct: hasSession ? 100 : 0,
    };
  });
}

export function computeWeeklyProgressPct(points: DailyWeekProgressPoint[], _nowTimestamp: number): number {
  if (points.length === 0) return 0;
  const completedDays = points.filter((point) => point.hasSession).length;
  return Math.min(100, Math.round((completedDays / points.length) * 100));
}

export function computeWeeklyProgressDelta(completedLogDates: Date[], nowTimestamp: number): number | null {
  const today = startOfLocalDay(new Date(nowTimestamp));
  const start = new Date(today);
  start.setDate(today.getDate() - 6);
  const prevStart = new Date(start);
  prevStart.setDate(prevStart.getDate() - 7);
  const todayExclusive = new Date(today);
  todayExclusive.setDate(today.getDate() + 1);

  const countInRange = (begin: Date, end: Date) => {
    let count = 0;
    for (const date of completedLogDates) {
      const day = startOfLocalDay(date);
      if (day.getTime() >= begin.getTime() && day.getTime() < end.getTime()) count += 1;
    }
    return count;
  };

  const thisWeek = countInRange(start, todayExclusive);
  const lastWeek = countInRange(prevStart, start);
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
