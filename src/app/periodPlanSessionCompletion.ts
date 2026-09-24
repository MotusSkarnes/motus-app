import { storedLogDatesMatch } from "./dateFormat";
import { findProgramForPeriodPlanEntry } from "./periodPlanEntryActions";
import { periodPlanEntryMatchesCompletedProgram } from "./periodPlanMerge";
import type { TrainingProgram, WorkoutLog } from "./types";

export type PeriodPlanDayCompletion = "none" | "partial" | "complete";

function isFullfortStatus(status: string): boolean {
  return status.toLowerCase().replace(/ø/g, "o") === "fullfort";
}

function exerciseKeyFromResult(result: NonNullable<WorkoutLog["results"]>[number]): string {
  return (
    result.programExerciseId?.trim() ||
    result.exerciseId?.trim() ||
    result.exerciseName.trim().toLowerCase()
  );
}

/** Fullført økt der minst én øvelse mangler avhukede sett. */
export function workoutLogSessionCompletion(log: WorkoutLog, program?: TrainingProgram | null): PeriodPlanDayCompletion {
  if (!isFullfortStatus(log.status)) return "none";
  const results = log.results ?? [];
  if (results.length === 0) return "complete";

  const completedKeys = new Set<string>();
  const seenKeys = new Set<string>();
  for (const result of results) {
    const key = exerciseKeyFromResult(result);
    if (!key) continue;
    seenKeys.add(key);
    if (result.completed) completedKeys.add(key);
  }

  // Øktloggen er et øyeblikksbilde av programmet kunden faktisk gjennomførte.
  // Programmet kan senere ha fått nye øvelser eller nye ID-er; da skal ikke en logg hvor
  // samtlige lagrede rader er avhuket degraderes til «delvis» i trenervisningen.
  if (seenKeys.size > 0 && results.every((result) => result.completed)) return "complete";

  const plannedExercises = program?.exercises ?? [];
  if (plannedExercises.length > 0) {
    const plannedLogged = plannedExercises.filter((exercise) => {
      const keys = [exercise.id.trim(), exercise.exerciseId.trim(), exercise.exerciseName.trim().toLowerCase()].filter(Boolean);
      return keys.some((key) => completedKeys.has(key));
    });
    if (plannedLogged.length >= plannedExercises.length) return "complete";
    if (plannedLogged.length > 0 || completedKeys.size > 0) return "partial";
    return "partial";
  }

  if (seenKeys.size === 0) return "complete";
  if (completedKeys.size >= seenKeys.size) return "complete";
  return "partial";
}

export function matchingPeriodPlanLogsForDay(input: {
  entry: string;
  plannedDate: string | null;
  logs: WorkoutLog[];
  programs: TrainingProgram[];
}): WorkoutLog[] {
  const entry = input.entry.trim();
  const plannedDate = input.plannedDate?.trim() ?? "";
  if (!entry || !plannedDate) return [];
  return input.logs.filter((log) => {
    if (!isFullfortStatus(log.status)) return false;
    if (!storedLogDatesMatch(log.date, plannedDate)) return false;
    return periodPlanEntryMatchesCompletedProgram(entry, log.programTitle, input.programs);
  });
}

function completionRank(status: PeriodPlanDayCompletion): number {
  if (status === "complete") return 2;
  if (status === "partial") return 1;
  return 0;
}

/** Velger den mest utfylte loggen for dagen, slik at treneren ser det kunden faktisk gjorde. */
export function pickBestPeriodPlanDayLog(input: {
  entry: string;
  plannedDate: string | null;
  logs: WorkoutLog[];
  programs: TrainingProgram[];
}): WorkoutLog | null {
  const matches = matchingPeriodPlanLogsForDay(input);
  if (matches.length === 0) return null;
  const program = findProgramForPeriodPlanEntry(input.entry, input.programs);
  return [...matches].sort((a, b) => {
    const byStatus = completionRank(workoutLogSessionCompletion(b, program)) - completionRank(workoutLogSessionCompletion(a, program));
    if (byStatus !== 0) return byStatus;
    return b.id.localeCompare(a.id);
  })[0] ?? null;
}

export function resolvePeriodPlanDayCompletion(input: {
  entry: string;
  plannedDate: string | null;
  logs: WorkoutLog[];
  programs: TrainingProgram[];
  markedComplete: boolean;
}): PeriodPlanDayCompletion {
  const entry = input.entry.trim();
  if (!entry) return "none";
  const matches = matchingPeriodPlanLogsForDay(input);
  if (matches.length > 0) {
    const program = findProgramForPeriodPlanEntry(entry, input.programs);
    const statuses = matches.map((log) => workoutLogSessionCompletion(log, program));
    if (statuses.includes("complete")) return "complete";
    if (statuses.includes("partial")) return "partial";
  }
  if (input.markedComplete) return "complete";
  return "none";
}
