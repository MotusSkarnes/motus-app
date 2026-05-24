import { resolveExerciseImageSrc } from "./exerciseIllustrations";
import { RUNNER_STRENGTH_COVER_IMAGE, SUB45_PROGRAM_TITLES, SUB60_PROGRAM_TITLES } from "./inspirationRunningPlans";
import type { TrainingSubTab } from "./exerciseCategories";
import type { Exercise, TrainingProgram } from "./types";

export const PROGRAM_IMAGE_BUCKET = "exercise-images";
export const PROGRAM_IMAGE_PREFIX = "program-covers";
export const SMILEPULS_COVER_IMAGE = "/program-covers/smilepuls.png";
export const REST_RECOVERY_COVER_IMAGE = "/program-covers/hvile-restitusjon.png";
export const STRENGTH_TRAINING_COVER_IMAGE = "/program-covers/styrketrening.png";
export const CONDITIONING_TRAINING_COVER_IMAGE = "/program-covers/kondisjon.png";
export const MOBILITY_TRAINING_COVER_IMAGE = "/program-covers/mobilitet.png";
export const ALLOWED_PROGRAM_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
export const MAX_PROGRAM_IMAGE_BYTES = 5 * 1024 * 1024;

const GROUP_WORKOUT_COVER_IMAGES: Record<string, string> = {
  smilepuls: SMILEPULS_COVER_IMAGE,
};

const PROGRAM_TITLE_COVER_IMAGES: Record<string, string> = {
  [normalizeProgramTitleKey(SUB60_PROGRAM_TITLES.strength)]: RUNNER_STRENGTH_COVER_IMAGE,
  [normalizeProgramTitleKey(SUB45_PROGRAM_TITLES.strength)]: RUNNER_STRENGTH_COVER_IMAGE,
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
    resolvedSrc === CONDITIONING_TRAINING_COVER_IMAGE ||
    resolvedSrc === MOBILITY_TRAINING_COVER_IMAGE
  );
}
