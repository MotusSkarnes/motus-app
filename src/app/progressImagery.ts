import {
  CONDITIONING_TRAINING_COVER_IMAGE,
  MOBILITY_TRAINING_COVER_IMAGE,
  STRENGTH_TRAINING_COVER_IMAGE,
} from "./programImage";

/** Lifestyle / mood images for Fremgang — not used in data-heavy areas. */
export const PROGRESS_HERO_IMAGE = STRENGTH_TRAINING_COVER_IMAGE;
export const PROGRESS_FLOW_IMAGE = CONDITIONING_TRAINING_COVER_IMAGE;
export const PROGRESS_WEEKLY_SUMMARY_IMAGE = "/program-covers/sub60-langtur-sone-2.png";
export const PROGRESS_RECOVERY_FALLBACK_IMAGE = MOBILITY_TRAINING_COVER_IMAGE;

/** Cinematic photos for PR-kort på Fremgang — øvelsesbanken beholder medisinske skisser. */
export const PROGRESS_PR_SQUAT_IMAGE = "/progress/pr-kneboy.png";
export const PROGRESS_PR_DEADLIFT_IMAGE = "/progress/pr-markloft.png";

const PROGRESS_PERSONAL_RECORD_IMAGES: Record<string, string> = {
  knebøy: PROGRESS_PR_SQUAT_IMAGE,
  markløft: PROGRESS_PR_DEADLIFT_IMAGE,
};

function normalizeExerciseNameKey(name: string): string {
  return name.trim().toLowerCase();
}

/** Lifestyle-bilde for PR på Fremgang; null = bruk vanlig øvelses-skisse. */
export function resolveProgressPersonalRecordImage(exerciseName: string): string | null {
  return PROGRESS_PERSONAL_RECORD_IMAGES[normalizeExerciseNameKey(exerciseName)] ?? null;
}
