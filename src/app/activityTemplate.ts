import { groupWorkoutLogTitle } from "./periodPlanEntryActions";
import type { TrainingProgram } from "./types";

export type ActivityTemplateKind = "group" | "activity";

const TEMPLATE_KIND_PREFIX = /^__motusTemplateKind=(group|activity)(?:\r?\n|$)/;

export function parseActivityTemplateKind(
  program: Pick<TrainingProgram, "notes">,
): ActivityTemplateKind | null {
  const match = String(program.notes ?? "").match(TEMPLATE_KIND_PREFIX);
  if (!match) return null;
  return match[1] as ActivityTemplateKind;
}

export function isActivityTemplate(program: Pick<TrainingProgram, "notes" | "exercises">): boolean {
  return parseActivityTemplateKind(program) !== null;
}

export function stripActivityTemplateMarker(notes: string): string {
  return notes.replace(TEMPLATE_KIND_PREFIX, "").trim();
}

export function buildActivityTemplateNotes(kind: ActivityTemplateKind, description: string): string {
  const body = description.trim();
  return body ? `__motusTemplateKind=${kind}\n${body}` : `__motusTemplateKind=${kind}`;
}

export function enrichProgramWithActivityTemplateKind(program: TrainingProgram): TrainingProgram {
  const kind = parseActivityTemplateKind(program);
  if (!kind) return program;
  return {
    ...program,
    activityTemplateKind: kind,
    notes: stripActivityTemplateMarker(program.notes),
  };
}

/** Lagret verdi i periodeplan-celle for denne malen. */
export function periodPlanEntryForActivityTemplate(program: Pick<TrainingProgram, "title" | "notes">): string {
  const kind = parseActivityTemplateKind(program);
  const title = program.title.trim();
  if (!title || !kind) return title;
  if (kind === "group") return groupWorkoutLogTitle(title);
  return `Aktivitet: ${title}`;
}

export function activityTemplateMatchesPeriodEntry(
  program: Pick<TrainingProgram, "title" | "notes">,
  entry: string,
): boolean {
  const expected = periodPlanEntryForActivityTemplate(program).trim().toLowerCase();
  const normalizedEntry = entry.trim().toLowerCase();
  if (!expected || !normalizedEntry) return false;
  if (expected === normalizedEntry) return true;
  const title = program.title.trim().toLowerCase();
  return Boolean(title) && (normalizedEntry === title || normalizedEntry.endsWith(`: ${title}`));
}

export function listActivityTemplates(
  programs: TrainingProgram[],
  kind?: ActivityTemplateKind,
): TrainingProgram[] {
  return programs
    .filter((program) => program.memberId === "__template__" && isActivityTemplate(program))
    .filter((program) => !kind || parseActivityTemplateKind(program) === kind);
}
