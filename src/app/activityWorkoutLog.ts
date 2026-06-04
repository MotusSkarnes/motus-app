import type { WorkoutLog } from "./types";

export const ACTIVITY_LOG_TITLE_PREFIX = "Aktivitet:";

export const ACTIVITY_NAME_SUGGESTIONS = [
  "Turgåing",
  "Sykling",
  "Svømming",
  "Padling",
  "Ski",
  "Dans",
  "Yoga",
  "Styrke annet sted",
  "Annet",
] as const;

export function activityWorkoutLogTitle(activityName: string): string {
  const trimmed = activityName.trim();
  if (trimmed.toLowerCase().startsWith("aktivitet:")) return trimmed;
  return `${ACTIVITY_LOG_TITLE_PREFIX} ${trimmed}`;
}

export function isActivityWorkoutLog(log: Pick<WorkoutLog, "programTitle">): boolean {
  return log.programTitle.trim().toLowerCase().startsWith("aktivitet:");
}

export function parseActivityNameFromLogTitle(programTitle: string): string {
  const trimmed = programTitle.trim();
  if (!trimmed.toLowerCase().startsWith("aktivitet:")) return trimmed;
  return trimmed.slice("aktivitet:".length).trim() || trimmed;
}

export function formatActivityDurationLabel(durationMinutes: string | undefined): string {
  const raw = String(durationMinutes ?? "").trim().replace(",", ".");
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return "";
  if (parsed < 60) return `${Math.round(parsed)} min`;
  const hours = Math.floor(parsed / 60);
  const minutes = Math.round(parsed % 60);
  if (minutes === 0) return `${hours} t`;
  return `${hours} t ${minutes} min`;
}
