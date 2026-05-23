import { resolveExerciseImageSrc } from "./exerciseIllustrations";
import type { Exercise, TrainingProgram } from "./types";

export const PROGRAM_IMAGE_BUCKET = "exercise-images";
export const PROGRAM_IMAGE_PREFIX = "program-covers";
export const ALLOWED_PROGRAM_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
export const MAX_PROGRAM_IMAGE_BYTES = 5 * 1024 * 1024;

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
