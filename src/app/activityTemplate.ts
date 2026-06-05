import { groupWorkoutLogTitle } from "./periodPlanEntryActions";
import type { TrainingProgram } from "./types";

export type ActivityTemplateKind = "group" | "activity" | "no-plan";

export const NO_PLAN_DAY_TEMPLATE_TITLE = "Ingen plan i dag";

const TEMPLATE_KIND_PREFIX = /^__motusTemplateKind=(group|activity|no-plan)(?:\r?\n|$)/;

export function parseActivityTemplateKind(
  program: Pick<TrainingProgram, "notes" | "activityTemplateKind">,
): ActivityTemplateKind | null {
  const storedKind = program.activityTemplateKind;
  if (storedKind === "group" || storedKind === "activity" || storedKind === "no-plan") return storedKind;
  const match = String(program.notes ?? "").match(TEMPLATE_KIND_PREFIX);
  if (!match) return null;
  return match[1] as ActivityTemplateKind;
}

export function isActivityTemplate(
  program: Pick<TrainingProgram, "notes" | "exercises" | "activityTemplateKind">,
): boolean {
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
export function periodPlanEntryForActivityTemplate(
  program: Pick<TrainingProgram, "title" | "notes" | "activityTemplateKind">,
): string {
  const kind = parseActivityTemplateKind(program);
  const title = program.title.trim();
  if (!title || !kind || kind === "no-plan") return title;
  if (kind === "group") return groupWorkoutLogTitle(title);
  return `Aktivitet: ${title}`;
}

export function activityTemplateMatchesPeriodEntry(
  program: Pick<TrainingProgram, "title" | "notes" | "activityTemplateKind">,
  entry: string,
): boolean {
  const expected = periodPlanEntryForActivityTemplate(program).trim().toLowerCase();
  const normalizedEntry = entry.trim().toLowerCase();
  if (!expected || !normalizedEntry) return false;
  if (expected === normalizedEntry) return true;
  const title = program.title.trim().toLowerCase();
  return Boolean(title) && (normalizedEntry === title || normalizedEntry.endsWith(`: ${title}`));
}

export function isPeriodPlanActivityTemplate(
  program: Pick<TrainingProgram, "memberId" | "notes" | "activityTemplateKind">,
): boolean {
  const kind = parseActivityTemplateKind(program);
  return program.memberId === "__template__" && (kind === "group" || kind === "activity");
}

export function listActivityTemplates(
  programs: TrainingProgram[],
  kind?: ActivityTemplateKind,
): TrainingProgram[] {
  return programs
    .filter((program) => isPeriodPlanActivityTemplate(program))
    .filter((program) => !kind || parseActivityTemplateKind(program) === kind);
}

export function findNoPlanDayCoverTemplate(
  programs: TrainingProgram[],
  ownerUserId?: string | null,
): TrainingProgram | null {
  const candidates = programs.filter(
    (program) => program.memberId === "__template__" && parseActivityTemplateKind(program) === "no-plan",
  );
  if (!candidates.length) return null;
  const trimmedOwner = ownerUserId?.trim();
  const scoped = trimmedOwner
    ? candidates.filter((program) => program.ownerUserId?.trim() === trimmedOwner)
    : candidates;
  const pool = scoped.length ? scoped : candidates;
  return pool.find((program) => program.imageUrl?.trim()) ?? pool[0] ?? null;
}

/** Skal programmet beholdes i medlems appState.programs etter sesjonsfiltrering? */
export function isMemberSessionScopedProgram(
  program: Pick<TrainingProgram, "memberId" | "notes" | "activityTemplateKind">,
  allowedMemberIds: Set<string>,
): boolean {
  const memberId = program.memberId.trim();
  if (allowedMemberIds.has(memberId)) return true;
  return memberId === "__template__" && isActivityTemplate(program);
}

/** Medlem: behold tildelte programmer + PT sine periodeplan-maler (ikke i memberIds). */
export function mergeMemberProgramsWithActivityTemplates(
  remotePrograms: TrainingProgram[],
  memberIds: Set<string>,
): TrainingProgram[] {
  const byId = new Map<string, TrainingProgram>();
  remotePrograms
    .filter((program) => memberIds.has(program.memberId.trim()))
    .forEach((program) => byId.set(program.id, program));
  remotePrograms
    .filter((program) => program.memberId === "__template__" && isActivityTemplate(program))
    .forEach((program) => byId.set(program.id, program));
  return Array.from(byId.values());
}
