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

/** Gruppe/aktivitet for periodeplan — inkl. eldre cover-maler uten notes-markør (telles som gruppetime). */
export function resolvePeriodPlanActivityTemplateKind(
  program: Pick<TrainingProgram, "memberId" | "title" | "notes" | "exercises" | "activityTemplateKind">,
): ActivityTemplateKind | null {
  const parsed = parseActivityTemplateKind(program);
  if (parsed === "group" || parsed === "activity") return parsed;
  if (program.memberId !== "__template__" || program.exercises.length > 0) return null;
  if (isNoPlanDayCoverProgram(program)) return null;
  return program.title.trim() ? "group" : null;
}

export function isPeriodPlanActivityTemplate(
  program: Pick<TrainingProgram, "memberId" | "title" | "notes" | "exercises" | "activityTemplateKind">,
): boolean {
  return resolvePeriodPlanActivityTemplateKind(program) !== null;
}

/** Gruppetrening-, aktivitet- og «Ingen plan i dag»-maler er felles på tvers av PT-er. */
export function isSharedOrgActivityTemplate(
  program: Pick<TrainingProgram, "memberId" | "title" | "notes" | "exercises" | "activityTemplateKind">,
): boolean {
  if (program.memberId !== "__template__") return false;
  if (isNoPlanDayCoverProgram(program)) return true;
  const kind = parseActivityTemplateKind(program) ?? resolvePeriodPlanActivityTemplateKind(program);
  return kind === "group" || kind === "activity";
}

export function sharedOrgActivityTemplateDedupeKey(
  program: Pick<TrainingProgram, "memberId" | "title" | "notes" | "activityTemplateKind">,
): string | null {
  if (!isSharedOrgActivityTemplate(program)) return null;
  if (isNoPlanDayCoverProgram(program)) {
    return `no-plan:${NO_PLAN_DAY_TEMPLATE_TITLE.toLowerCase()}`;
  }
  const kind = parseActivityTemplateKind(program) ?? resolvePeriodPlanActivityTemplateKind(program);
  const title = program.title.trim().toLowerCase();
  return kind && title ? `${kind}:${title}` : null;
}

/** Behold nyeste rad per felles mal (samme type + tittel). */
export function dedupeSharedOrgActivityTemplates(programs: TrainingProgram[]): TrainingProgram[] {
  const sharedByKey = new Map<string, TrainingProgram>();
  const other: TrainingProgram[] = [];
  for (const program of programs) {
    const key = sharedOrgActivityTemplateDedupeKey(program);
    if (!key) {
      other.push(program);
      continue;
    }
    const existing = sharedByKey.get(key);
    if (!existing || programCreatedAtSortMs(program) > programCreatedAtSortMs(existing)) {
      sharedByKey.set(key, program);
    }
  }
  return [...other, ...Array.from(sharedByKey.values())];
}

/** «Ingen plan i dag»-mal — gjenkjennes via notes-markør eller fast tittel (eldre rader uten markør). */
export function isNoPlanDayCoverProgram(
  program: Pick<TrainingProgram, "memberId" | "title" | "notes" | "activityTemplateKind">,
): boolean {
  if (program.memberId !== "__template__") return false;
  if (parseActivityTemplateKind(program) === "no-plan") return true;
  return program.title.trim() === NO_PLAN_DAY_TEMPLATE_TITLE;
}

export function listActivityTemplates(
  programs: TrainingProgram[],
  kind?: ActivityTemplateKind,
): TrainingProgram[] {
  return programs
    .filter((program) => isPeriodPlanActivityTemplate(program))
    .filter((program) => !kind || resolvePeriodPlanActivityTemplateKind(program) === kind);
}

/** PT Program-fanen: felles maler deduplisert og filtrert på gruppe vs aktivitet. */
export function listSharedOrgTemplatesForTrainerSubTab(
  programs: TrainingProgram[],
  subTab: "group" | "activity",
): TrainingProgram[] {
  const sharedTemplates = dedupeSharedOrgActivityTemplates(
    programs.filter((program) => program.memberId === "__template__" && isSharedOrgActivityTemplate(program)),
  );
  return listActivityTemplates(sharedTemplates, subTab);
}

function programCreatedAtSortMs(program: Pick<TrainingProgram, "createdAt">): number {
  const raw = program.createdAt?.trim() ?? "";
  if (!raw) return 0;
  const iso = Date.parse(raw);
  if (!Number.isNaN(iso)) return iso;
  const dotted = raw.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (dotted) {
    const parsed = Date.parse(`${dotted[3]}-${dotted[2]}-${dotted[1]}`);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

function pickNewestNoPlanCoverProgram(programs: TrainingProgram[]): TrainingProgram | null {
  if (!programs.length) return null;
  const sorted = [...programs].sort(
    (left, right) => programCreatedAtSortMs(right) - programCreatedAtSortMs(left),
  );
  return sorted.find((program) => program.imageUrl?.trim()) ?? sorted[0] ?? null;
}

export function findNoPlanDayCoverTemplate(
  programs: TrainingProgram[],
  _ownerUserId?: string | null,
): TrainingProgram | null {
  const candidates = programs.filter((program) => isNoPlanDayCoverProgram(program));
  return pickNewestNoPlanCoverProgram(candidates);
}

/** Skal programmet beholdes i medlems appState.programs etter sesjonsfiltrering? */
export function isMemberSessionScopedProgram(
  program: Pick<TrainingProgram, "memberId" | "notes" | "activityTemplateKind">,
  allowedMemberIds: Set<string>,
): boolean {
  const memberId = program.memberId.trim();
  if (allowedMemberIds.has(memberId)) return true;
  return memberId === "__template__" && (isActivityTemplate(program) || isNoPlanDayCoverProgram(program));
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
    .filter(
      (program) =>
        program.memberId === "__template__" && (isActivityTemplate(program) || isNoPlanDayCoverProgram(program)),
    )
    .forEach((program) => byId.set(program.id, program));
  return Array.from(byId.values());
}

/** Etter hydrate: sørg for at PT-bilde finnes i programs når vi har URL men malen mangler i listen. */
export function ensureNoPlanCoverProgramInList(
  programs: TrainingProgram[],
  imageUrl: string,
  ownerUserId?: string | null,
): TrainingProgram[] {
  const trimmedUrl = imageUrl.trim();
  if (!trimmedUrl) return programs;
  if (findNoPlanDayCoverTemplate(programs, ownerUserId)?.imageUrl?.trim()) return programs;
  const existing = findNoPlanDayCoverTemplate(programs, ownerUserId);
  if (existing) {
    return programs.map((program) =>
      program.id === existing.id ? { ...program, imageUrl: trimmedUrl, activityTemplateKind: "no-plan" as const } : program,
    );
  }
  const trimmedOwner = ownerUserId?.trim();
  return [
    ...programs,
    {
      id: `hydrated-no-plan-cover-${trimmedOwner || "pt"}`,
      memberId: "__template__",
      title: NO_PLAN_DAY_TEMPLATE_TITLE,
      goal: "",
      notes: buildActivityTemplateNotes("no-plan", ""),
      createdAt: "",
      exercises: [],
      imageUrl: trimmedUrl,
      activityTemplateKind: "no-plan" as const,
      ...(trimmedOwner ? { ownerUserId: trimmedOwner } : {}),
    },
  ];
}
