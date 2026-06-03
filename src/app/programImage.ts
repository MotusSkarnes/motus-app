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

export function resolveProgramImageSrc(
  program: Pick<TrainingProgram, "imageUrl" | "title">,
  coverExercise?: Pick<Exercise, "id" | "imageUrl" | "category" | "group" | "name"> | null,
  options?: { subTab?: TrainingSubTab },
): string | null {
  const custom = program.imageUrl?.trim();
  if (custom) return custom;
  const byTitle = program.title ? resolveProgramCoverImageByTitle(program.title) : null;
  if (byTitle) return byTitle;
  if (options?.subTab === "strength") return STRENGTH_TRAINING_COVER_IMAGE;
  if (options?.subTab === "conditioning") return CONDITIONING_TRAINING_COVER_IMAGE;
  if (options?.subTab === "mobility" || options?.subTab === "rehab") return MOBILITY_TRAINING_COVER_IMAGE;
  if (coverExercise) return resolveExerciseImageSrc(coverExercise);
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
