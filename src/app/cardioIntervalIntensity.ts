import { isCardioCooldownStepName } from "./cardioEquipment";
import type { ProgramExercise } from "./types";

export type CardioIntensityLevel = "low" | "medium" | "high";

export const CARDIO_INTENSITY_OPTIONS: Array<{ id: CardioIntensityLevel; label: string }> = [
  { id: "low", label: "Lav" },
  { id: "medium", label: "Middels" },
  { id: "high", label: "Høy" },
];

export function cardioIntensityDisplayLabel(level: CardioIntensityLevel): string {
  return CARDIO_INTENSITY_OPTIONS.find((option) => option.id === level)?.label ?? "Middels";
}

function isCardioIntensityLevel(value: unknown): value is CardioIntensityLevel {
  return value === "low" || value === "medium" || value === "high";
}

/** Merker øvelsen med intensitet — endrer ikke fart, stigning eller puls (PT fyller inn). */
export function applyCardioIntensityToExercise(
  exercise: ProgramExercise,
  level: CardioIntensityLevel,
): ProgramExercise {
  return { ...exercise, cardioIntensity: level };
}

export function inferCardioIntensityFromExercise(exercise: ProgramExercise): CardioIntensityLevel | null {
  if (isCardioIntensityLevel(exercise.cardioIntensity)) return exercise.cardioIntensity;
  return null;
}

export function inferCardioIntensityFromDraft(draft: ProgramExercise[]): CardioIntensityLevel {
  const drag = draft.find((row) => /^drag\b/i.test(row.exerciseName.trim()));
  if (drag) {
    const inferred = inferCardioIntensityFromExercise(drag);
    if (inferred) return inferred;
  }
  const warmup = draft.find((row) => /^oppvarming$/i.test(row.exerciseName.trim()));
  if (warmup) {
    const inferred = inferCardioIntensityFromExercise(warmup);
    if (inferred) return inferred;
  }
  return "medium";
}

function isIntervalDraftRow(
  row: ProgramExercise,
  options?: { conditioningBuilder?: boolean },
): boolean {
  return (
    Boolean(options?.conditioningBuilder) ||
    /^oppvarming$/i.test(row.exerciseName.trim()) ||
    /^drag\b/i.test(row.exerciseName.trim()) ||
    isCardioCooldownStepName(row.exerciseName) ||
    Boolean(String(row.durationMinutes ?? "").trim())
  );
}

export function applyCardioIntensityToDraft(
  draft: ProgramExercise[],
  level: CardioIntensityLevel,
  options?: { exerciseId?: string; conditioningBuilder?: boolean },
): ProgramExercise[] {
  return draft.map((row) => {
    if (options?.exerciseId && row.id !== options.exerciseId) return row;
    if (!isIntervalDraftRow(row, options)) return row;
    return applyCardioIntensityToExercise(row, level);
  });
}
