import {
  cardioIntensityDisplayLabel,
  type CardioIntensityLevel,
} from "./cardioIntervalIntensity";
import {
  categoryForSubTab,
  programDraftUsesHoldFields,
  programExerciseHoldSeconds,
  type TrainingSubTab,
} from "./exerciseCategories";
import { formatProgramExercisePrescription } from "./programExercisePresentation";
import type { Exercise, ProgramExercise } from "./types";

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const n = Number.parseInt(String(value ?? "").trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function estimateDraftExerciseSeconds(
  item: ProgramExercise,
  linkedExercise: Exercise | undefined,
  programsSubTab: TrainingSubTab,
): number {
  const isCardio =
    programsSubTab === "conditioning" ||
    linkedExercise?.category === "Kondisjon" ||
    Boolean(String(item.durationMinutes ?? "").trim());
  const isStretch = programDraftUsesHoldFields(linkedExercise?.category, programsSubTab);

  if (isCardio) {
    const sets = parsePositiveInt(item.sets, 1);
    const minutes = Number.parseFloat(String(item.durationMinutes ?? "").trim()) || 0;
    const seconds = Number.parseFloat(String(item.holdSeconds ?? "").trim()) || 0;
    const rest = parsePositiveInt(item.restSeconds, 0);
    return sets * (minutes * 60 + seconds) + Math.max(0, sets - 1) * rest;
  }

  if (isStretch) {
    const sets = parsePositiveInt(item.sets, 2);
    const hold = parsePositiveInt(
      item.holdSeconds,
      parsePositiveInt(programExerciseHoldSeconds(item, linkedExercise?.category), 30),
    );
    const rest = parsePositiveInt(item.restSeconds, 30);
    return sets * hold + Math.max(0, sets - 1) * rest;
  }

  const sets = parsePositiveInt(item.sets, 3);
  const rest = parsePositiveInt(item.restSeconds, 90);
  return sets * 150 + Math.max(0, sets - 1) * rest;
}

export function computeProgramDraftStats(
  draft: ProgramExercise[],
  exercisesById: Map<string, Exercise>,
  programsSubTab: TrainingSubTab,
  options?: { cardioIntensity?: CardioIntensityLevel },
): { exerciseCount: number; totalMinutes: number; intensityLabel: string } {
  if (!draft.length) {
    return { exerciseCount: 0, totalMinutes: 0, intensityLabel: "—" };
  }
  const totalSeconds = draft.reduce((sum, item) => {
    const linked = exercisesById.get(item.exerciseId);
    return sum + estimateDraftExerciseSeconds(item, linked, programsSubTab);
  }, 0);
  const totalMinutes = Math.max(1, Math.round(totalSeconds / 60));
  const avgRest =
    draft.reduce((sum, item) => sum + parsePositiveInt(item.restSeconds, 60), 0) / draft.length;
  const intensityLabel =
    programsSubTab === "conditioning" && options?.cardioIntensity
      ? cardioIntensityDisplayLabel(options.cardioIntensity)
      : programsSubTab === "mobility" || programsSubTab === "rehab"
        ? "Lav"
        : avgRest >= 120
          ? "Lav"
          : avgRest >= 75
            ? "Middels"
            : "Høy";
  return { exerciseCount: draft.length, totalMinutes, intensityLabel };
}

export function draftExercisePrescriptionLabel(
  item: ProgramExercise,
  index: number,
  draft: ProgramExercise[],
  linkedExercise: Exercise | undefined,
  programsSubTab: TrainingSubTab,
): string {
  const isCardio =
    programsSubTab === "conditioning" ||
    linkedExercise?.category === "Kondisjon" ||
    Boolean(String(item.durationMinutes ?? "").trim());
  const isStretch = programDraftUsesHoldFields(linkedExercise?.category, programsSubTab);
  return formatProgramExercisePrescription(item, index, draft, linkedExercise ? [linkedExercise] : [], {
    treatAsCardio: isCardio,
    treatAsHold: isStretch,
  });
}

export function programCategoryLabel(subTab: TrainingSubTab): string {
  return categoryForSubTab(subTab);
}
