import {
  buildActivityTemplateNotes,
  dedupeSharedOrgActivityTemplates,
  enrichProgramWithActivityTemplateKind,
  resolvePeriodPlanActivityTemplateKind,
} from "./activityTemplate";
import { resolveGroupWorkoutCoverImage } from "./programImage";
import type { TrainingProgram } from "./types";

/** Standard Motus-gruppetimeklasser — skal finnes som felles maler for alle PT-er. */
export const DEFAULT_MOTUS_GROUP_CLASS_NAMES = [
  "Smilepuls",
  "Sykkel 45",
  "Mølle 45",
  "Sterk",
  "Sirkeltrening",
  "Stram opp",
  "Dansemix",
  "Yoga",
  "Tabata",
  "Godt voksen",
  "Step styrke",
] as const;

function normalizeGroupClassTitle(title: string): string {
  return title.trim().toLowerCase();
}

function slugifyGroupClassTitle(title: string): string {
  return normalizeGroupClassTitle(title)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function hasGroupTemplateForTitle(programs: TrainingProgram[], title: string): boolean {
  const normalized = normalizeGroupClassTitle(title);
  return programs.some((program) => {
    if (program.memberId !== "__template__") return false;
    const kind = resolvePeriodPlanActivityTemplateKind(program);
    if (kind !== "group") return false;
    return normalizeGroupClassTitle(program.title) === normalized;
  });
}

function buildDefaultGroupClassTemplate(className: string): TrainingProgram {
  const cover = resolveGroupWorkoutCoverImage(className);
  return enrichProgramWithActivityTemplateKind({
    id: `motus-default-group-${slugifyGroupClassTitle(className)}`,
    memberId: "__template__",
    title: className,
    goal: "",
    notes: buildActivityTemplateNotes("group", ""),
    createdAt: "",
    exercises: [],
    activityTemplateKind: "group",
    ...(cover ? { imageUrl: cover } : {}),
  });
}

/** Legg inn standard gruppetime-maler som mangler i listen (felles for alle trenere). */
export function ensureDefaultMotusGroupClassTemplates(programs: TrainingProgram[]): TrainingProgram[] {
  const byId = new Map<string, TrainingProgram>();
  programs.forEach((program) => byId.set(program.id, program));
  for (const className of DEFAULT_MOTUS_GROUP_CLASS_NAMES) {
    if (hasGroupTemplateForTitle(programs, className)) continue;
    const template = buildDefaultGroupClassTemplate(className);
    if (!byId.has(template.id)) {
      byId.set(template.id, template);
    }
  }
  return dedupeSharedOrgActivityTemplates(Array.from(byId.values()));
}
