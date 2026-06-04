import type { WorkoutLog } from "./types";

export const ACTIVITY_LOG_TITLE_PREFIX = "Aktivitet:";

export const ACTIVITY_NAME_SUGGESTIONS = [
  "Alpint",
  "Badminton",
  "Buldring",
  "Dans",
  "Fjelltur",
  "Fotball",
  "Frisbeegolf",
  "Golf",
  "Håndball",
  "Klatring",
  "Langrenn",
  "Løping",
  "Padel",
  "Padling",
  "Pilates",
  "Ridning",
  "Roing",
  "Roller ski",
  "Ski",
  "Spinning",
  "Squash",
  "Stavtur",
  "Styrke annet sted",
  "Svømming",
  "Sykling",
  "Tennis",
  "Terrengsykling",
  "Turgåing",
  "Volleyball",
  "Yoga",
  "Annet",
] as const;

/** Filtrerer forslag der første bokstav(er) brukeren skrev matcher starten av aktivitetsnavnet. */
export function filterActivityNameSuggestions(
  query: string,
  suggestions: readonly string[] = ACTIVITY_NAME_SUGGESTIONS,
): string[] {
  const trimmed = query.trim();
  if (!trimmed) return [...suggestions];
  const prefix = trimmed.toLocaleLowerCase("nb");
  return suggestions.filter((name) => name.toLocaleLowerCase("nb").startsWith(prefix));
}

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

export const GROUP_LOG_TITLE_PREFIX = "Gruppetime:";

export function isGroupWorkoutLog(log: Pick<WorkoutLog, "programTitle">): boolean {
  return log.programTitle.trim().toLowerCase().startsWith("gruppetime:");
}

export function groupWorkoutLogTitle(className: string): string {
  const trimmed = className.trim();
  if (trimmed.toLowerCase().startsWith("gruppetime:")) return trimmed;
  return `${GROUP_LOG_TITLE_PREFIX} ${trimmed}`;
}

export function parseGroupClassNameFromLogTitle(programTitle: string): string {
  const trimmed = programTitle.trim();
  if (!trimmed.toLowerCase().startsWith("gruppetime:")) return trimmed;
  return trimmed.slice("gruppetime:".length).trim() || trimmed;
}

export function workoutReflectionEmoji(level?: 1 | 2 | 3 | 4 | 5): string {
  if (!level || level <= 1) return "🥳";
  if (level === 2) return "🙂";
  if (level === 3) return "😌";
  if (level === 4) return "😮‍💨";
  return "🥵";
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
