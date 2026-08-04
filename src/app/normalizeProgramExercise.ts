import type { ExercisePrescriptionFieldKey, ProgramExercise } from "./types";

const PRESCRIPTION_FIELD_KEYS = new Set<ExercisePrescriptionFieldKey>([
  "minutes",
  "seconds",
  "kg",
  "reps",
  "pause",
  "seatSettings",
  "distance",
  "heartRate",
  "speed",
  "incline",
  "custom1",
  "custom2",
]);

function asText(value: unknown): string {
  if (value == null) return "";
  return String(value);
}

function normalizeLogFieldKeys(value: unknown): ExercisePrescriptionFieldKey[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const keys = value.filter(
    (key): key is ExercisePrescriptionFieldKey =>
      typeof key === "string" && PRESCRIPTION_FIELD_KEYS.has(key as ExercisePrescriptionFieldKey),
  );
  return keys.length ? keys : undefined;
}

/** Normaliser programøvelser fra DB/hydrate slik at .trim()-kall ikke krasjer UI. */
export function normalizeProgramExercise(raw: unknown, index = 0): ProgramExercise {
  const row = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const id = asText(row.id).trim() || `prog-ex-${index + 1}`;
  const blockTypeRaw = asText(row.blockType).trim();
  const blockType =
    blockTypeRaw === "superset" || blockTypeRaw === "triset" || blockTypeRaw === "circuit"
      ? blockTypeRaw
      : undefined;
  const repsUnitRaw = asText(row.repsUnit).trim();
  const weightUnitRaw = asText(row.weightUnit).trim();
  const cardioIntensityRaw = asText(row.cardioIntensity).trim();
  const logFieldKeys = normalizeLogFieldKeys(row.logFieldKeys);

  return {
    id,
    exerciseId: asText(row.exerciseId).trim(),
    exerciseName: asText(row.exerciseName).trim() || "Øvelse",
    sets: asText(row.sets).trim() || "1",
    reps: asText(row.reps),
    weight: asText(row.weight),
    restSeconds: asText(row.restSeconds),
    notes: asText(row.notes),
    holdSeconds: asText(row.holdSeconds),
    durationMinutes: asText(row.durationMinutes),
    distanceKm: asText(row.distanceKm),
    speed: asText(row.speed),
    incline: asText(row.incline),
    targetHrPercent: asText(row.targetHrPercent),
    seatSetting: asText(row.seatSetting),
    customField1: asText(row.customField1),
    customField2: asText(row.customField2),
    blockId: asText(row.blockId).trim() || undefined,
    blockRounds: asText(row.blockRounds).trim() || undefined,
    ...(repsUnitRaw === "reps" || repsUnitRaw === "minutes" ? { repsUnit: repsUnitRaw } : {}),
    ...(weightUnitRaw === "kg" || weightUnitRaw === "seconds" ? { weightUnit: weightUnitRaw } : {}),
    ...(cardioIntensityRaw === "low" || cardioIntensityRaw === "medium" || cardioIntensityRaw === "high"
      ? { cardioIntensity: cardioIntensityRaw }
      : {}),
    ...(blockType ? { blockType } : {}),
    ...(logFieldKeys ? { logFieldKeys } : {}),
  };
}

export function normalizeProgramExercises(raw: unknown): ProgramExercise[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item, index) => normalizeProgramExercise(item, index));
}
