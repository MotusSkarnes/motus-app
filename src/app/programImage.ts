import { activityTemplateMatchesPeriodEntry, parseActivityTemplateKind } from "./activityTemplate";
import { findProgramForPeriodPlanEntry, isGroupPeriodPlanEntry, isPassivePeriodPlanEntry, isRestPeriodPlanEntry, resolveGroupClassNameFromPeriodEntry } from "./periodPlanEntryActions";
import { getTrainingProgramSubTab } from "./trainingProgramKind";
import { resolveExerciseImageSrc } from "./exerciseIllustrations";
import { RUNNER_STRENGTH_COVER_IMAGE, RUNNER_MOBILITY_COVER_IMAGE, SUB45_PROGRAM_TITLES, SUB60_PROGRAM_TITLES } from "./inspirationRunningPlans";
import type { TrainingSubTab } from "./exerciseCategories";
import type { Exercise, TrainingProgram } from "./types";

export const PROGRAM_IMAGE_BUCKET = "exercise-images";
export const PROGRAM_IMAGE_PREFIX = "program-covers";
export const SMILEPULS_COVER_IMAGE = "/program-covers/smilepuls.png";
export const STRONG_TONE_GROUP_COVER_IMAGE = "/program-covers/sterk-og-stram-opp.png";
export const HIIT_TABATA_GROUP_COVER_IMAGE = "/program-covers/hiit-tabata.png";
export const CYCLING_GROUP_COVER_IMAGE = "/program-covers/sykkel-gruppetime.png";
export const TREADMILL_GROUP_COVER_IMAGE = "/program-covers/molle-45.png";
export const YOGA_GROUP_COVER_IMAGE = "/program-covers/yoga-gruppetime.png";
export const CIRCUIT_GROUP_COVER_IMAGE = "/program-covers/sirkeltrening.png";
export const SENIORS_GROUP_COVER_IMAGE = "/program-covers/godt-voksen-gruppetime.png";
export const REST_RECOVERY_COVER_IMAGE = "/program-covers/hvile-restitusjon.png";
/** Forside når det ikke er planlagt økt denne dagen (tom dag i periodeplan eller ingen plan). */
export const NO_PLAN_DAY_COVER_IMAGE = "/program-covers/ingen-plan-i-dag.png";
export const STRENGTH_TRAINING_COVER_IMAGE = "/program-covers/styrketrening.png";
export const CONDITIONING_TRAINING_COVER_IMAGE = "/program-covers/kondisjon.png";
export const MOBILITY_TRAINING_COVER_IMAGE = "/program-covers/mobilitet.png";
export const ALLOWED_PROGRAM_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
export const MAX_PROGRAM_IMAGE_BYTES = 5 * 1024 * 1024;
/** Typisk innholdsbredde på kundens mobil (programkort). */
export const MEMBER_PROGRAM_THUMB_PREVIEW_WIDTH_PX = 390;
export const MEMBER_PROGRAM_THUMB_HEIGHT_PX = 118;
/** Bredde/høyde på kundens programkort-thumb — brukes ved opplasting. */
export const MEMBER_PROGRAM_THUMB_ASPECT =
  MEMBER_PROGRAM_THUMB_PREVIEW_WIDTH_PX / MEMBER_PROGRAM_THUMB_HEIGHT_PX;
/** Hero-lærred: samme breddeformat som programkort (unngår ekstra beskjæring ved visning). */
export const PROGRAM_COVER_HERO_CANVAS_WIDTH_PX = 1580;
export const PROGRAM_COVER_HERO_CANVAS_HEIGHT_PX = Math.round(
  PROGRAM_COVER_HERO_CANVAS_WIDTH_PX / MEMBER_PROGRAM_THUMB_ASPECT,
);
/** Tegn bilde litt mindre enn maks — hele motivet synlig + rom til pan ved 100 % zoom. */
export const PROGRAM_COVER_HERO_CONTAIN_SCALE = 0.92;
/** Zoom-glidebryter: 1 = hele opplastet bilde, høyere = innzoom. */
export const PROGRAM_COVER_ZOOM_MIN = 1;
export const PROGRAM_COVER_ZOOM_DEFAULT = 1;
export const PROGRAM_COVER_ZOOM_MAX = 2.25;

const GROUP_WORKOUT_COVER_IMAGES: Record<string, string> = {
  smilepuls: SMILEPULS_COVER_IMAGE,
  sterk: STRONG_TONE_GROUP_COVER_IMAGE,
  "stram opp": STRONG_TONE_GROUP_COVER_IMAGE,
  hiit: HIIT_TABATA_GROUP_COVER_IMAGE,
  tabata: HIIT_TABATA_GROUP_COVER_IMAGE,
  sykkel: CYCLING_GROUP_COVER_IMAGE,
  "sykkel 45": CYCLING_GROUP_COVER_IMAGE,
  mølle: TREADMILL_GROUP_COVER_IMAGE,
  "mølle 45": TREADMILL_GROUP_COVER_IMAGE,
  molle: TREADMILL_GROUP_COVER_IMAGE,
  "molle 45": TREADMILL_GROUP_COVER_IMAGE,
  yoga: YOGA_GROUP_COVER_IMAGE,
  sirkel: CIRCUIT_GROUP_COVER_IMAGE,
  sirkeltrening: CIRCUIT_GROUP_COVER_IMAGE,
  "godt voksen": SENIORS_GROUP_COVER_IMAGE,
};

const PROGRAM_TITLE_COVER_IMAGES: Record<string, string> = {
  [normalizeProgramTitleKey(SUB60_PROGRAM_TITLES.strength)]: RUNNER_STRENGTH_COVER_IMAGE,
  [normalizeProgramTitleKey(SUB45_PROGRAM_TITLES.strength)]: RUNNER_STRENGTH_COVER_IMAGE,
  [normalizeProgramTitleKey(SUB60_PROGRAM_TITLES.mobility)]: RUNNER_MOBILITY_COVER_IMAGE,
  [normalizeProgramTitleKey(SUB45_PROGRAM_TITLES.mobility)]: RUNNER_MOBILITY_COVER_IMAGE,
};

function normalizeProgramTitleKey(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
}

function resolveProgramCoverImageByTitle(title: string): string | null {
  const key = normalizeProgramTitleKey(title);
  if (!key) return null;
  return PROGRAM_TITLE_COVER_IMAGES[key] ?? null;
}

function normalizeGroupWorkoutClassKey(className: string): string {
  return className
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function resolveGroupWorkoutCoverImage(className: string): string | null {
  const key = normalizeGroupWorkoutClassKey(className);
  if (!key) return null;
  return GROUP_WORKOUT_COVER_IMAGES[key] ?? null;
}

export function resolveRestDayCoverImage(): string {
  return REST_RECOVERY_COVER_IMAGE;
}

export function resolveNoPlanDayCoverImage(): string {
  return NO_PLAN_DAY_COVER_IMAGE;
}

/** Behold forsidebilde fra enten kilde ved merge (f.eks. lokal opplasting vs. sky uten kolonne). */
export function mergeProgramImageUrl(
  primary?: string,
  secondary?: string,
): string | undefined {
  const primaryTrimmed = primary?.trim();
  if (primaryTrimmed) return primaryTrimmed;
  const secondaryTrimmed = secondary?.trim();
  if (secondaryTrimmed) return secondaryTrimmed;
  return undefined;
}

/** Etter sky-synk: server-rad vinner; manglende imageUrl = slettet forside. */
export function pickProgramImageUrlAfterServerSync(
  remote: Pick<TrainingProgram, "imageUrl">,
): string | undefined {
  return remote.imageUrl?.trim() || undefined;
}

/** Ved duplikat-rader: kun nyeste programs forside (ikke gjenopprett eldre URL etter sletting). */
export function pickProgramImageUrlFromDuplicateMerge(newer: Pick<TrainingProgram, "imageUrl">): string | undefined {
  return newer.imageUrl?.trim() || undefined;
}

/** Direkte tabell-rad over hydrate-liste (unngå utdatert image_url i cache). */
export function pickProgramImageUrlFromSnapshotMerge(
  direct: Pick<TrainingProgram, "imageUrl">,
): string | undefined {
  return direct.imageUrl?.trim() || undefined;
}

/** Første øvelse i programrekkefølge som finnes i øvelsesbanken. */
export function resolveFirstProgramCoverExercise(
  program: Pick<TrainingProgram, "exercises">,
  exercises: Array<Pick<Exercise, "id" | "imageUrl" | "category" | "group" | "name">>,
): Pick<Exercise, "id" | "imageUrl" | "category" | "group" | "name"> | null {
  const byId = new Map(exercises.map((exercise) => [exercise.id, exercise]));
  for (const row of program.exercises) {
    const exercise = byId.get(row.exerciseId);
    if (exercise) return exercise;
  }
  return null;
}

/** Eldre opplastinger lagret portrait-variant — vis hero som matcher programkort. */
export function resolveProgramCoverDisplayUrl(imageUrl: string): string {
  const trimmed = imageUrl.trim();
  if (!trimmed) return trimmed;
  return trimmed.replace(/-portrait\.(jpe?g|png|webp)(\?|$)/i, "-hero.$1$2");
}

export function resolveProgramImageSrc(
  program: Pick<TrainingProgram, "imageUrl" | "title">,
  coverExercise?: Pick<Exercise, "id" | "imageUrl" | "category" | "group" | "name"> | null,
  options?: { subTab?: TrainingSubTab },
): string | null {
  const custom = program.imageUrl?.trim();
  if (custom) return resolveProgramCoverDisplayUrl(custom);
  const byTitle = program.title ? resolveProgramCoverImageByTitle(program.title) : null;
  if (byTitle) return byTitle;
  if (coverExercise) return resolveExerciseImageSrc(coverExercise);
  if (options?.subTab === "strength") return STRENGTH_TRAINING_COVER_IMAGE;
  if (options?.subTab === "conditioning" || options?.subTab === "group") return CONDITIONING_TRAINING_COVER_IMAGE;
  if (options?.subTab === "mobility" || options?.subTab === "rehab" || options?.subTab === "activity") {
    return MOBILITY_TRAINING_COVER_IMAGE;
  }
  return null;
}

export function programHasCustomCoverImage(program: Pick<TrainingProgram, "imageUrl">): boolean {
  return Boolean(program.imageUrl?.trim());
}

export function programCoverUsesPhotoStyle(
  program: Pick<TrainingProgram, "imageUrl">,
  resolvedSrc?: string | null,
): boolean {
  if (programHasCustomCoverImage(program)) return true;
  return (
    resolvedSrc === STRENGTH_TRAINING_COVER_IMAGE ||
    resolvedSrc === RUNNER_STRENGTH_COVER_IMAGE ||
    resolvedSrc === RUNNER_MOBILITY_COVER_IMAGE ||
    resolvedSrc === CONDITIONING_TRAINING_COVER_IMAGE ||
    resolvedSrc === MOBILITY_TRAINING_COVER_IMAGE
  );
}

export function resolvePeriodPlanEntryCoverImage(
  entry: string,
  options: {
    activityTemplates?: TrainingProgram[];
    memberPrograms?: TrainingProgram[];
    exercises?: Exercise[];
    exerciseCategoryById?: Map<string, Exercise["category"]>;
  } = {},
): string | null {
  const trimmed = entry.trim();
  if (!trimmed) return resolveNoPlanDayCoverImage();
  if (isPassivePeriodPlanEntry(entry)) {
    return isRestPeriodPlanEntry(entry) ? resolveRestDayCoverImage() : resolveNoPlanDayCoverImage();
  }

  const templates = options.activityTemplates ?? [];
  const matchedTemplate = templates.find((template) => activityTemplateMatchesPeriodEntry(template, entry));
  if (matchedTemplate) {
    const customImage = matchedTemplate.imageUrl?.trim();
    if (customImage) return resolveProgramCoverDisplayUrl(customImage);
    const matchedTemplateKind = parseActivityTemplateKind(matchedTemplate);
    const templateFallback = resolveProgramImageSrc(matchedTemplate, null, {
      subTab:
        matchedTemplateKind === "activity"
          ? "activity"
          : matchedTemplateKind === "group"
            ? "group"
            : "conditioning",
    });
    if (templateFallback) return templateFallback;
  }

  if (isGroupPeriodPlanEntry(entry)) {
    return (
      resolveGroupWorkoutCoverImage(resolveGroupClassNameFromPeriodEntry(entry)) ??
      CONDITIONING_TRAINING_COVER_IMAGE
    );
  }

  if (trimmed.toLowerCase().startsWith("aktivitet:")) {
    return MOBILITY_TRAINING_COVER_IMAGE;
  }

  const program = findProgramForPeriodPlanEntry(entry, options.memberPrograms ?? []);
  if (program) {
    const coverExercise = resolveFirstProgramCoverExercise(program, options.exercises ?? []);
    return resolveProgramImageSrc(program, coverExercise, {
      subTab: getTrainingProgramSubTab(program, options.exerciseCategoryById ?? new Map(), options.exercises ?? []),
    });
  }

  return CONDITIONING_TRAINING_COVER_IMAGE;
}
