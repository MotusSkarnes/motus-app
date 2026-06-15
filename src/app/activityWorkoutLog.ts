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

export type ReflectionLevel = 1 | 2 | 3 | 4 | 5;

/** Lagret nivå (høyere = mer sliten/tungt) → visning 1–5 der 1 = sliten og 5 = bra. */
export function reflectionLevelToUi(stored: ReflectionLevel): ReflectionLevel {
  return (6 - stored) as ReflectionLevel;
}

/** UI-nivå (1 = sliten … 5 = bra) → lagret skala for beregninger og historikk. */
export function reflectionLevelToStorage(ui: ReflectionLevel): ReflectionLevel {
  return (6 - ui) as ReflectionLevel;
}

/** Emoji for visning i felt (ui-skala: venstre = bra, høyre = sliten/tungt). */
export function workoutReflectionEmoji(uiLevel?: ReflectionLevel): string {
  if (!uiLevel || uiLevel <= 1) return "🥵";
  if (uiLevel === 2) return "😮‍💨";
  if (uiLevel === 3) return "😌";
  if (uiLevel === 4) return "🙂";
  return "🥳";
}

/** Tall vist til PT/medlem: 1/5 = sliten/tungt, 5/5 = lett og god form. */
export function formatReflectionLevelForDisplay(stored?: ReflectionLevel): string {
  if (!stored) return "–";
  return `${reflectionLevelToUi(stored)}/5`;
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
