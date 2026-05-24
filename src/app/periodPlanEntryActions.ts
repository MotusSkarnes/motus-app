import { parseStoredLogDate } from "./dateFormat";
import { WEEKDAY_PLAN_ORDER } from "./periodPlanSwaps";
import type { PeriodSchedulePlan, TrainingProgram } from "./types";

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

export function isRestPeriodPlanEntry(entry: string): boolean {
  const normalized = entry.trim().toLowerCase();
  return normalized.includes("hvile") || normalized.includes("restitusjon");
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

function normalizePlanEntryLabel(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .replace(/[.:;,-]+$/g, "")
    .trim();
}

function planEntryTokenKey(value: string): string {
  return normalizePlanEntryLabel(value)
    .split(" ")
    .filter(Boolean)
    .sort()
    .join(" ");
}

function scoreProgramTitleMatch(entryNorm: string, titleNorm: string): number {
  if (!entryNorm || !titleNorm) return 0;
  if (entryNorm === titleNorm) return 100;
  if (planEntryTokenKey(entryNorm) === planEntryTokenKey(titleNorm)) return 95;
  if (entryNorm.startsWith(titleNorm) || titleNorm.startsWith(entryNorm)) {
    const minLen = Math.min(entryNorm.length, titleNorm.length);
    return minLen >= 3 ? 80 + minLen : 0;
  }
  if (entryNorm.includes(titleNorm) || titleNorm.includes(entryNorm)) {
    const minLen = Math.min(entryNorm.length, titleNorm.length);
    return minLen >= 4 ? 60 + minLen : 0;
  }
  return 0;
}

export function findProgramForPeriodPlanEntry(
  entry: string,
  programs: TrainingProgram[],
): TrainingProgram | null {
  const trimmed = entry.trim();
  if (!trimmed || isGroupPeriodPlanEntry(entry) || isPassivePeriodPlanEntry(entry)) return null;

  const entryNorm = normalizePlanEntryLabel(trimmed);
  let best: { program: TrainingProgram; score: number } | null = null;

  for (const program of programs) {
    const titleNorm = normalizePlanEntryLabel(program.title);
    const score = scoreProgramTitleMatch(entryNorm, titleNorm);
    if (score <= 0) continue;
    if (
      !best ||
      score > best.score ||
      (score === best.score && program.title.trim().length > best.program.title.trim().length)
    ) {
      best = { program, score };
    }
  }

  return best?.program ?? null;
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

export function collectActivePeriodPlanEntryLabels(periodPlans: PeriodSchedulePlan[]): string[] {
  const labels = new Set<string>();
  for (const plan of periodPlans) {
    for (const week of plan.weeklyPlans ?? []) {
      for (const dayKey of WEEKDAY_PLAN_ORDER) {
        const entry = week.days[dayKey]?.trim() ?? "";
        if (!entry || isPassivePeriodPlanEntry(entry) || isGroupPeriodPlanEntry(entry)) continue;
        labels.add(entry);
      }
    }
  }
  return [...labels];
}

export function buildPeriodPlanLinkedProgramIdSet(
  periodPlans: PeriodSchedulePlan[],
  programs: TrainingProgram[],
): Set<string> {
  const linked = new Set<string>();
  for (const entry of collectActivePeriodPlanEntryLabels(periodPlans)) {
    const program = findProgramForPeriodPlanEntry(entry, programs);
    if (program) linked.add(program.id);
  }
  return linked;
}

export function findPeriodPlanForProgram(
  program: TrainingProgram,
  periodPlans: PeriodSchedulePlan[],
  programs: TrainingProgram[],
): PeriodSchedulePlan | null {
  for (const plan of periodPlans) {
    for (const week of plan.weeklyPlans ?? []) {
      for (const dayKey of WEEKDAY_PLAN_ORDER) {
        const entry = week.days[dayKey]?.trim() ?? "";
        if (!entry || isPassivePeriodPlanEntry(entry) || isGroupPeriodPlanEntry(entry)) continue;
        const matched = findProgramForPeriodPlanEntry(entry, programs);
        if (matched?.id === program.id) return plan;
      }
    }
  }
  return null;
}

/** Kort etikett i periodeplan-listen — full øktinfo vises først ved trykk inn. */
export function getPeriodPlanDayListLabel(entry: string, action: PeriodPlanEntryAction): string {
  const trimmed = entry.trim();
  if (!trimmed) return "Ingen plan";
  if (action.kind === "log-group") return groupWorkoutLogTitle(action.className);
  if (action.kind === "start-program") return action.program.title.trim() || "Økt planlagt";
  if (action.kind === "log-generic") return "Planlagt aktivitet";
  const normalized = trimmed.toLowerCase();
  if (normalized.includes("aktiv restitusjon")) return "Aktiv restitusjon";
  if (normalized.includes("hvile")) return "Hvile";
  if (normalized.includes("ingen plan")) return "Ingen plan";
  return "Hviledag";
}
