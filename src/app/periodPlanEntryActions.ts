import { parseStoredLogDate } from "./dateFormat";
import type { TrainingProgram } from "./types";

/** Planlagt periodeplan-dato er etter dagens dato (lokal kalenderdag). */
export function isPeriodPlanEntryDateInFuture(plannedDate: string | null | undefined, now = new Date()): boolean {
  const trimmed = plannedDate?.trim();
  if (!trimmed) return false;
  const parsed = parseStoredLogDate(trimmed);
  if (!parsed) return false;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const planned = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  return planned.getTime() > today.getTime();
}

export function isGroupPeriodPlanEntry(entry: string): boolean {
  const normalized = entry.trim().toLowerCase();
  return normalized === "gruppetime" || normalized.startsWith("gruppetime:");
}

export function isPassivePeriodPlanEntry(entry: string): boolean {
  const normalized = entry.trim().toLowerCase();
  return (
    !normalized ||
    normalized === "ingen plan valgt" ||
    normalized === "hvile / restitusjon" ||
    normalized === "aktiv restitusjon"
  );
}

/** Klassenavn til logGroupWorkout (uten «Gruppetime:»-prefiks). */
export function resolveGroupClassNameFromPeriodEntry(entry: string): string {
  const trimmed = entry.trim();
  if (trimmed.toLowerCase().startsWith("gruppetime:")) {
    const className = trimmed.slice("gruppetime:".length).trim();
    return className || "Smilepuls";
  }
  if (trimmed.toLowerCase() === "gruppetime") {
    return "Smilepuls";
  }
  return trimmed;
}

export function groupWorkoutLogTitle(className: string): string {
  const trimmed = className.trim();
  if (trimmed.toLowerCase().startsWith("gruppetime:")) return trimmed;
  return `Gruppetime: ${trimmed}`;
}

export function findProgramForPeriodPlanEntry(
  entry: string,
  programs: TrainingProgram[],
): TrainingProgram | null {
  const normalized = entry.trim().toLowerCase();
  if (!normalized || isGroupPeriodPlanEntry(entry) || isPassivePeriodPlanEntry(entry)) return null;
  return programs.find((program) => program.title.trim().toLowerCase() === normalized) ?? null;
}

export type PeriodPlanEntryAction =
  | { kind: "start-program"; program: TrainingProgram }
  | { kind: "log-group"; className: string; label: string }
  | { kind: "log-generic"; title: string }
  | { kind: "none" };

export function resolvePeriodPlanEntryAction(
  entry: string,
  programs: TrainingProgram[],
): PeriodPlanEntryAction {
  const trimmed = entry.trim();
  if (!trimmed || isPassivePeriodPlanEntry(trimmed)) {
    return { kind: "none" };
  }
  if (isGroupPeriodPlanEntry(trimmed)) {
    return {
      kind: "log-group",
      className: resolveGroupClassNameFromPeriodEntry(trimmed),
      label: trimmed,
    };
  }
  const program = findProgramForPeriodPlanEntry(trimmed, programs);
  if (program) {
    return { kind: "start-program", program };
  }
  return { kind: "log-generic", title: trimmed };
}
