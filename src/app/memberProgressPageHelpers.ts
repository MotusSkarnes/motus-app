import { getWeekKey } from "./memberProgressGamification";

export type CurrentWeekDayDot = {
  key: string;
  label: string;
  trained: boolean;
  isToday: boolean;
  isFuture: boolean;
};

const WEEKDAY_LABELS = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"] as const;

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function computeConsecutiveTrainingDays(completedLogDates: Date[], now = new Date()): number {
  const daySet = new Set(completedLogDates.map((date) => startOfLocalDay(date).toDateString()));
  let count = 0;
  const cursor = startOfLocalDay(now);
  while (daySet.has(cursor.toDateString())) {
    count += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return count;
}

export function buildCurrentWeekDayDots(completedLogDates: Date[], now = new Date()): CurrentWeekDayDot[] {
  const daySet = new Set(completedLogDates.map((date) => startOfLocalDay(date).toDateString()));
  const today = startOfLocalDay(now);
  const mondayOffset = (today.getDay() + 6) % 7;
  const monday = new Date(today);
  monday.setDate(today.getDate() - mondayOffset);

  return WEEKDAY_LABELS.map((label, index) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + index);
    const dayStart = startOfLocalDay(day);
    return {
      key: dayStart.toISOString(),
      label,
      trained: daySet.has(dayStart.toDateString()),
      isToday: dayStart.getTime() === today.getTime(),
      isFuture: dayStart.getTime() > today.getTime(),
    };
  });
}

export function computeLongestStreakWeeks(completedLogDates: Date[]): number {
  const trainingWeekKeys = Array.from(new Set(completedLogDates.map((date) => getWeekKey(date)))).sort();
  if (!trainingWeekKeys.length) return 0;

  let longest = 1;
  let current = 1;
  for (let index = 1; index < trainingWeekKeys.length; index += 1) {
    const prevKey = trainingWeekKeys[index - 1];
    const key = trainingWeekKeys[index];
    const [year, week] = key.split("-").map(Number);
    const prevWeekDate = new Date(year, 0, 4 + (week - 2) * 7);
    const expectedPrev = getWeekKey(prevWeekDate);
    if (expectedPrev === prevKey) {
      current += 1;
      longest = Math.max(longest, current);
    } else {
      current = 1;
    }
  }
  return longest;
}

export function buildProgressHighlightLine(workoutsLast7: number, weeklyWorkoutCounts: number[]): string | null {
  if (workoutsLast7 <= 0) return null;
  const bestRecent = weeklyWorkoutCounts.length ? Math.max(...weeklyWorkoutCounts) : 0;
  if (workoutsLast7 >= bestRecent && workoutsLast7 >= 3) {
    return `Sterkeste uke på lenge! ${workoutsLast7} økter siste 7 dager`;
  }
  if (workoutsLast7 >= 4) {
    return `${workoutsLast7} økter siste 7 dager — hold flyten!`;
  }
  return `${workoutsLast7} ${workoutsLast7 === 1 ? "økt" : "økter"} siste 7 dager`;
}
