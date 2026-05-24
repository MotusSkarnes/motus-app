import { resolveExerciseImageSrc } from "./exerciseIllustrations";
import type { Exercise, TrainingProgram } from "./types";

export const PROGRAM_IMAGE_BUCKET = "exercise-images";
export const PROGRAM_IMAGE_PREFIX = "program-covers";
export const SMILEPULS_COVER_IMAGE = "/program-covers/smilepuls.png";
export const REST_RECOVERY_COVER_IMAGE = "/program-covers/hvile-restitusjon.png";
export const ALLOWED_PROGRAM_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
export const MAX_PROGRAM_IMAGE_BYTES = 5 * 1024 * 1024;

const GROUP_WORKOUT_COVER_IMAGES: Record<string, string> = {
  smilepuls: SMILEPULS_COVER_IMAGE,
};

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
  program: Pick<TrainingProgram, "imageUrl">,
  coverExercise?: Pick<Exercise, "id" | "imageUrl" | "category" | "group" | "name"> | null,
): string | null {
  const custom = program.imageUrl?.trim();
  if (custom) return custom;
  if (coverExercise) return resolveExerciseImageSrc(coverExercise);
  return null;
}

export function programHasCustomCoverImage(program: Pick<TrainingProgram, "imageUrl">): boolean {
  return Boolean(program.imageUrl?.trim());
}
