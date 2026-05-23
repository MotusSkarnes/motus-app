import { getWeekKey } from "./memberProgressGamification";

export type TrainingCalendarDayStatus = "completed" | "planned" | "missed" | "none";

export function getMondayStart(date: Date): Date {
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const mondayOffset = (day.getDay() + 6) % 7;
  return new Date(day.getFullYear(), day.getMonth(), day.getDate() - mondayOffset);
}

export function getWeekDates(mondayStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, index) => {
    return new Date(mondayStart.getFullYear(), mondayStart.getMonth(), mondayStart.getDate() + index);
  });
}

export function toCalendarDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseCalendarDateKey(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function getIsoWeekLabel(date: Date): string {
  const key = getWeekKey(date);
  const weekNumber = Number(key.split("-")[1]);
  return `Uke ${weekNumber}`;
}

const WEEKDAY_SHORT = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"] as const;

export function getWeekdayShortLabel(date: Date): string {
  return WEEKDAY_SHORT[(date.getDay() + 6) % 7];
}

export function shortWorkoutLabel(raw: string, maxLength = 14): string {
  const trimmed = raw.trim();
  if (!trimmed) return "—";
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength - 1)}…`;
}

export function isSameCalendarDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
