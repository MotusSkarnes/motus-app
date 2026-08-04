import type { Exercise, ProgramExercise } from "./types";

export type CardioEquipmentId = "treadmill" | "rowing" | "skierg" | "bike" | "airbike";

export const CARDIO_EQUIPMENT_OPTIONS: Array<{ id: CardioEquipmentId; label: string; hint: string }> = [
  { id: "treadmill", label: "Tredemølle", hint: "Fart (km/t) og stigning" },
  { id: "rowing", label: "Romaskin", hint: "Split, taktfrekvens og dempfer" },
  { id: "skierg", label: "Stakemaskin", hint: "Split, taktfrekvens og dempfer" },
  { id: "bike", label: "Sykkel", hint: "Motstand / watt og kadens" },
  { id: "airbike", label: "Airbike", hint: "RPM og valgfri motstand" },
];

const MATCHERS: Record<CardioEquipmentId, (exercise: Exercise) => boolean> = {
  treadmill: (exercise) => {
    const eq = exercise.equipment.trim().toLowerCase();
    const name = exercise.name.trim().toLowerCase();
    return eq.includes("tredem") || eq.includes("mølle") || name.includes("mølle");
  },
  rowing: (exercise) => {
    const eq = exercise.equipment.trim().toLowerCase();
    const name = exercise.name.trim().toLowerCase();
    return eq.includes("romaskin") || eq.includes("roing") || name.includes("romaskin") || name.includes("roing");
  },
  skierg: (exercise) => {
    const eq = exercise.equipment.trim().toLowerCase();
    const name = exercise.name.trim().toLowerCase();
    return (
      eq.includes("stakemaskin") ||
      eq.includes("ski erg") ||
      eq.includes("skierg") ||
      eq.includes("ski-erg") ||
      name.includes("stakemaskin") ||
      name.includes("ski erg") ||
      name.includes("skierg")
    );
  },
  bike: (exercise) => {
    const eq = exercise.equipment.trim().toLowerCase();
    const name = exercise.name.trim().toLowerCase();
    return (
      eq.includes("sykkel") ||
      eq.includes("spinning") ||
      eq.includes("ergometer") ||
      name.includes("sykkel") ||
      name.includes("spinning")
    );
  },
  airbike: (exercise) => {
    const eq = exercise.equipment.trim().toLowerCase();
    const name = exercise.name.trim().toLowerCase();
    return eq.includes("airbike") || name.includes("airbike");
  },
};

export function inferCardioEquipmentIdFromExercise(exercise: Pick<Exercise, "equipment" | "name" | "category">): CardioEquipmentId | null {
  if (exercise.category !== "Kondisjon") return null;
  const full = { ...exercise, id: "", group: "", level: "Nybegynner" as const, description: "", imageUrl: "" };
  for (const option of CARDIO_EQUIPMENT_OPTIONS) {
    if (MATCHERS[option.id](full as Exercise)) return option.id;
  }
  return null;
}

export function pickCardioExerciseForEquipment(allExercises: Exercise[], equipmentId: CardioEquipmentId): Exercise | undefined {
  if (!allExercises.length) return undefined;
  const nameLo = (e: Exercise) => e.name.trim().toLowerCase();
  const matches = allExercises.filter((e) => e.category === "Kondisjon" && MATCHERS[equipmentId](e));
  const withInterval = matches.find((e) => nameLo(e).includes("intervall"));
  if (withInterval) return withInterval;
  if (matches.length) return matches[0];
  return allExercises.find((e) => MATCHERS[equipmentId](e)) ?? allExercises.find((e) => e.category === "Kondisjon");
}

export function defaultCardioEquipmentId(): CardioEquipmentId {
  return "rowing";
}

/** Avsluttende rolig fase i kondisjons-/intervallprogram (ikke bare løp). */
export const CARDIO_COOLDOWN_STEP_NAME = "Nedtrapping";

export function isCardioCooldownStepName(name: unknown): boolean {
  const lower = String(name ?? "").trim().toLowerCase();
  return lower.startsWith("nedjogg") || lower.startsWith("nedtrapp") || lower.includes("cooldown");
}

type CardioStepKind = "warmup" | "drag" | "cooldown";

export function buildCardioTemplateRow(
  base: Exercise,
  kind: CardioStepKind,
  equipmentId: CardioEquipmentId,
  options?: { dragIndex?: number; intensity?: ProgramExercise["cardioIntensity"] },
): ProgramExercise {
  const dragIndex = options?.dragIndex ?? 1;
  const shared = {
    exerciseId: base.id,
    reps: "",
    weight: "",
    targetHrPercent: kind === "warmup" || kind === "cooldown" ? "" : "",
    notes: "",
    cardioIntensity: options?.intensity,
  };

  if (kind === "warmup") {
    return {
      id: "",
      exerciseName: "Oppvarming",
      sets: "1",
      durationMinutes: "10",
      holdSeconds: "",
      restSeconds: "0",
      seatSetting: "",
      customField1: "",
      customField2: "",
      speed: equipmentId === "treadmill" ? "7" : "",
      incline: equipmentId === "treadmill" ? "1" : "",
      ...shared,
    };
  }

  if (kind === "cooldown") {
    return {
      id: "",
      exerciseName: CARDIO_COOLDOWN_STEP_NAME,
      sets: "1",
      durationMinutes: "5",
      holdSeconds: "",
      restSeconds: "0",
      seatSetting: "",
      customField1: "",
      customField2: "",
      speed: equipmentId === "treadmill" ? "6" : "",
      incline: equipmentId === "treadmill" ? "0" : "",
      ...shared,
    };
  }

  return {
    id: "",
    exerciseName: `Drag ${dragIndex}`,
    sets: "4",
    durationMinutes: "4",
    holdSeconds: "",
    restSeconds: "180",
    speed: equipmentId === "treadmill" ? "14" : "",
    incline: equipmentId === "treadmill" ? "2" : "",
    seatSetting: equipmentId === "rowing" || equipmentId === "skierg" ? "5" : equipmentId === "bike" ? "8" : "",
    customField1:
      equipmentId === "rowing" ? "2:05" : equipmentId === "skierg" ? "2:20" : equipmentId === "bike" ? "180" : "",
    customField2:
      equipmentId === "rowing"
        ? "26"
        : equipmentId === "skierg"
          ? "40"
          : equipmentId === "bike"
            ? "85"
            : equipmentId === "airbike"
              ? "55"
              : "",
    ...shared,
  };
}

export function rebindDraftToCardioEquipment(
  draft: ProgramExercise[],
  allExercises: Exercise[],
  equipmentId: CardioEquipmentId,
  options?: { conditioningBuilder?: boolean },
): ProgramExercise[] {
  const base = pickCardioExerciseForEquipment(allExercises, equipmentId);
  if (!base) return draft;

  return draft.map((row) => {
    const isCardioRow =
      options?.conditioningBuilder ||
      /^oppvarming$/i.test(row.exerciseName.trim()) ||
      /^drag\b/i.test(row.exerciseName.trim()) ||
      isCardioCooldownStepName(row.exerciseName) ||
      Boolean(String(row.durationMinutes ?? "").trim());
    if (!isCardioRow) return row;

    const kind: CardioStepKind = /^oppvarming$/i.test(row.exerciseName.trim())
      ? "warmup"
      : isCardioCooldownStepName(row.exerciseName)
        ? "cooldown"
        : "drag";
    const dragMatch = row.exerciseName.trim().match(/^drag\s*(\d+)?/i);
    const dragIndex = dragMatch ? Number(dragMatch[1]) || 1 : 1;
    const rebuilt = buildCardioTemplateRow(base, kind, equipmentId, {
      dragIndex,
      intensity: row.cardioIntensity,
    });

    return {
      ...row,
      exerciseId: base.id,
      speed: equipmentId === "treadmill" ? row.speed?.trim() || rebuilt.speed || "" : "",
      incline: equipmentId === "treadmill" ? row.incline?.trim() || rebuilt.incline || "" : "",
      seatSetting: equipmentId !== "treadmill" ? row.seatSetting?.trim() || rebuilt.seatSetting || "" : "",
      customField1: equipmentId !== "treadmill" ? row.customField1?.trim() || rebuilt.customField1 || "" : "",
      customField2: equipmentId !== "treadmill" ? row.customField2?.trim() || rebuilt.customField2 || "" : "",
    };
  });
}

export function mapExerciseToCardioEquipment(exercise: Exercise, equipmentId: CardioEquipmentId): Exercise {
  const match = pickCardioExerciseForEquipment([exercise], equipmentId);
  return match ?? exercise;
}

export function resolveCardioEquipmentIdForProgramRow(
  row: ProgramExercise,
  bankExercise: Exercise | undefined,
  fallback: CardioEquipmentId = "treadmill",
): CardioEquipmentId {
  return inferCardioEquipmentIdFromExercise(bankExercise ?? { category: "Kondisjon", equipment: "", name: row.exerciseName }) ?? fallback;
}

export function cardioIntervalMetricHints(
  row: ProgramExercise,
  bankExercise: Exercise | undefined,
  fallback: CardioEquipmentId = "treadmill",
): { equipmentId: CardioEquipmentId; primaryHint: string; secondaryHint: string } {
  const equipmentId = resolveCardioEquipmentIdForProgramRow(row, bankExercise, fallback);
  if (equipmentId === "rowing" || equipmentId === "skierg") {
    return {
      equipmentId,
      primaryHint: row.customField1?.trim() ? `${row.customField1.trim()} /500 m` : "-",
      secondaryHint: row.customField2?.trim() ? `${row.customField2.trim()} spm` : "-",
    };
  }
  if (equipmentId === "bike") {
    return {
      equipmentId,
      primaryHint: row.customField1?.trim() ? `${row.customField1.trim()} W` : "-",
      secondaryHint: row.customField2?.trim() ? `${row.customField2.trim()} rpm` : "-",
    };
  }
  if (equipmentId === "airbike") {
    return {
      equipmentId,
      primaryHint: row.customField2?.trim() ? `${row.customField2.trim()} rpm` : "-",
      secondaryHint: row.customField1?.trim() ? row.customField1.trim() : "-",
    };
  }
  return {
    equipmentId: "treadmill",
    primaryHint: row.speed?.trim() ? `${row.speed.trim()} km/t` : "-",
    secondaryHint: row.incline?.trim() ? `${row.incline.trim()}%` : "-",
  };
}

export function cardioIntervalEditFieldLabels(equipmentId: CardioEquipmentId): { primary: string; secondary: string } {
  if (equipmentId === "rowing" || equipmentId === "skierg")
    return { primary: "Split (min / 500 m)", secondary: "Taktfrekvens (spm)" };
  if (equipmentId === "bike") return { primary: "Watt", secondary: "Kadens (rpm)" };
  if (equipmentId === "airbike") return { primary: "Motstand", secondary: "RPM" };
  return { primary: "Fart (km/t)", secondary: "Stigning (%)" };
}

export function cardioIntervalRestMetricHints(equipmentId: CardioEquipmentId): { primaryHint: string; secondaryHint: string } {
  if (equipmentId === "rowing") return { primaryHint: "Lett ro", secondaryHint: "Lav spm" };
  if (equipmentId === "skierg") return { primaryHint: "Lett staking", secondaryHint: "Lav spm" };
  if (equipmentId === "bike") return { primaryHint: "Lett tråkk", secondaryHint: "Lav watt" };
  if (equipmentId === "airbike") return { primaryHint: "Lett tempo", secondaryHint: "Lav motstand" };
  return { primaryHint: "Rolig", secondaryHint: "0–1%" };
}
