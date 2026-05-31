import type { ProgramExercise } from "./types";

export type CardioIntensityLevel = "low" | "medium" | "high";

export type CardioIntervalPhase = "warmup" | "work" | "cooldown";

export const CARDIO_INTENSITY_OPTIONS: Array<{ id: CardioIntensityLevel; label: string }> = [
  { id: "low", label: "Lav" },
  { id: "medium", label: "Middels" },
  { id: "high", label: "Høy" },
];

type CardioIntensityPreset = {
  targetHrPercent: string;
  speed: string;
  incline: string;
};

const CARDIO_INTENSITY_PRESETS: Record<CardioIntensityLevel, Record<CardioIntervalPhase, CardioIntensityPreset>> = {
  low: {
    warmup: { targetHrPercent: "60–70", speed: "6.5", incline: "0.5" },
    work: { targetHrPercent: "75–82", speed: "10.5", incline: "1" },
    cooldown: { targetHrPercent: "50–60", speed: "5", incline: "0" },
  },
  medium: {
    warmup: { targetHrPercent: "65–75", speed: "7", incline: "1" },
    work: { targetHrPercent: "82–88", speed: "12", incline: "1.5" },
    cooldown: { targetHrPercent: "55–65", speed: "5.5", incline: "0" },
  },
  high: {
    warmup: { targetHrPercent: "70–78", speed: "8", incline: "1" },
    work: { targetHrPercent: "88–95", speed: "14", incline: "2" },
    cooldown: { targetHrPercent: "55–65", speed: "5.5", incline: "0" },
  },
};

export function cardioIntensityDisplayLabel(level: CardioIntensityLevel): string {
  return CARDIO_INTENSITY_OPTIONS.find((option) => option.id === level)?.label ?? "Middels";
}

export function detectCardioIntervalPhase(exerciseName: string): CardioIntervalPhase {
  const name = exerciseName.trim().toLowerCase();
  if (/^oppvarming/.test(name)) return "warmup";
  if (/^nedjogg/.test(name)) return "cooldown";
  return "work";
}

export function cardioIntensityPreset(
  level: CardioIntensityLevel,
  phase: CardioIntervalPhase,
): CardioIntensityPreset {
  return CARDIO_INTENSITY_PRESETS[level][phase];
}

export function applyCardioIntensityToExercise(
  exercise: ProgramExercise,
  level: CardioIntensityLevel,
): ProgramExercise {
  const phase = detectCardioIntervalPhase(exercise.exerciseName);
  const preset = cardioIntensityPreset(level, phase);
  return {
    ...exercise,
    targetHrPercent: preset.targetHrPercent,
    speed: preset.speed,
    incline: preset.incline,
  };
}

export function inferCardioIntensityFromExercise(exercise: ProgramExercise): CardioIntensityLevel | null {
  const phase = detectCardioIntervalPhase(exercise.exerciseName);
  const hr = String(exercise.targetHrPercent ?? "").trim();
  for (const level of CARDIO_INTENSITY_OPTIONS.map((option) => option.id)) {
    if (hr && hr === cardioIntensityPreset(level, phase).targetHrPercent) return level;
  }
  const match = hr.match(/(\d+)/);
  const firstHr = match ? Number(match[1]) : NaN;
  if (!Number.isFinite(firstHr)) return null;
  if (phase === "cooldown") {
    if (firstHr <= 58) return "low";
    if (firstHr <= 62) return "medium";
    return "high";
  }
  if (phase === "warmup") {
    if (firstHr <= 67) return "low";
    if (firstHr <= 72) return "medium";
    return "high";
  }
  if (firstHr <= 80) return "low";
  if (firstHr <= 86) return "medium";
  return "high";
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

export function applyCardioIntensityToDraft(
  draft: ProgramExercise[],
  level: CardioIntensityLevel,
  options?: { exerciseId?: string; conditioningBuilder?: boolean },
): ProgramExercise[] {
  return draft.map((row) => {
    if (options?.exerciseId && row.id !== options.exerciseId) return row;
    const isIntervalRow =
      options?.conditioningBuilder ||
      /^oppvarming$/i.test(row.exerciseName.trim()) ||
      /^drag\b/i.test(row.exerciseName.trim()) ||
      /^nedjogg/i.test(row.exerciseName.trim()) ||
      Boolean(String(row.durationMinutes ?? "").trim());
    if (!isIntervalRow) return row;
    return applyCardioIntensityToExercise(row, level);
  });
}
