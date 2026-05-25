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
export const PROGRESS_PR_LAT_PULLDOWN_IMAGE = "/progress/pr-nedtrekk.png";
export const PROGRESS_PR_CLOSE_GRIP_PULLDOWN_IMAGE = "/progress/pr-smal-nedtrekk.png";
export const PROGRESS_PR_HIP_THRUST_IMAGE = "/progress/pr-hip-thrust.png";

const PROGRESS_PERSONAL_RECORD_IMAGES: Record<string, string> = {
  knebøy: PROGRESS_PR_SQUAT_IMAGE,
  markløft: PROGRESS_PR_DEADLIFT_IMAGE,
  nedtrekk: PROGRESS_PR_LAT_PULLDOWN_IMAGE,
  "nedtrekk bredt grep": PROGRESS_PR_LAT_PULLDOWN_IMAGE,
  "smal nedtrekk": PROGRESS_PR_CLOSE_GRIP_PULLDOWN_IMAGE,
  "nedtrekk smalt grep": PROGRESS_PR_CLOSE_GRIP_PULLDOWN_IMAGE,
  "hip thrust": PROGRESS_PR_HIP_THRUST_IMAGE,
  "hip trust": PROGRESS_PR_HIP_THRUST_IMAGE,
  "single leg hip trust": PROGRESS_PR_HIP_THRUST_IMAGE,
  "single leg hip thrust": PROGRESS_PR_HIP_THRUST_IMAGE,
};

const PROGRESS_EXERCISE_DISPLAY_NAMES: Record<string, string> = {
  "hip trust": "Hip thrust",
  "single leg hip trust": "Single-leg hip thrust",
};

function normalizeExerciseNameKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Lifestyle-bilde for PR på Fremgang; null = bruk vanlig øvelses-skisse. */
export function resolveProgressExerciseDisplayName(exerciseName: string): string {
  const trimmed = exerciseName.trim();
  return PROGRESS_EXERCISE_DISPLAY_NAMES[normalizeExerciseNameKey(trimmed)] ?? trimmed;
}

export function resolveProgressPersonalRecordImage(exerciseName: string): string | null {
  return PROGRESS_PERSONAL_RECORD_IMAGES[normalizeExerciseNameKey(exerciseName)] ?? null;
}
