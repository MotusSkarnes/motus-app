import type { Exercise, ExercisePrescriptionFieldKey, ProgramExercise } from "./types";
import { isHoldBasedExerciseCategory } from "./exerciseCategories";
import { uid } from "./storage";

export type { ExercisePrescriptionFieldKey };

export type ExercisePrescriptionFieldDef = {
  key: ExercisePrescriptionFieldKey;
  label: string;
  shortLabel: string;
  programField: keyof ProgramExercise;
  placeholder: string;
};

export const EXERCISE_PRESCRIPTION_FIELD_OPTIONS: ExercisePrescriptionFieldDef[] = [
  { key: "minutes", label: "Minutter", shortLabel: "min", programField: "durationMinutes", placeholder: "Min" },
  { key: "seconds", label: "Sekunder", shortLabel: "sek", programField: "holdSeconds", placeholder: "Sek" },
  { key: "kg", label: "Kg", shortLabel: "kg", programField: "weight", placeholder: "Kg" },
  { key: "reps", label: "Reps", shortLabel: "reps", programField: "reps", placeholder: "Reps" },
  { key: "pause", label: "Pause", shortLabel: "pause", programField: "restSeconds", placeholder: "Sek" },
  { key: "seatSettings", label: "Seteinnstillinger", shortLabel: "sete", programField: "seatSetting", placeholder: "F.eks. høyde 4" },
  { key: "distance", label: "Distanse (km)", shortLabel: "km", programField: "distanceKm", placeholder: "Km" },
  { key: "heartRate", label: "Puls", shortLabel: "puls", programField: "targetHrPercent", placeholder: "F.eks. 145" },
  { key: "speed", label: "Fart (km/t)", shortLabel: "km/t", programField: "speed", placeholder: "Km/t" },
  { key: "incline", label: "Stigning (%)", shortLabel: "stign", programField: "incline", placeholder: "%" },
  { key: "custom1", label: "Egendefinert 1", shortLabel: "e1", programField: "customField1", placeholder: "Verdi" },
  { key: "custom2", label: "Egendefinert 2", shortLabel: "e2", programField: "customField2", placeholder: "Verdi" },
];

const FIELD_KEYS = new Set(EXERCISE_PRESCRIPTION_FIELD_OPTIONS.map((option) => option.key));

function parsePrescriptionFieldKeys(value: unknown): ExercisePrescriptionFieldKey[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => String(entry ?? "").trim())
    .filter((entry): entry is ExercisePrescriptionFieldKey => FIELD_KEYS.has(entry as ExercisePrescriptionFieldKey));
}

/** Leser lagrede felt fra DB (undefined = ikke satt ennå). */
export function parsePrescriptionFieldsFromDb(value: unknown): ExercisePrescriptionFieldKey[] | undefined {
  if (value == null) return undefined;
  const unique = Array.from(new Set(parsePrescriptionFieldKeys(value)));
  return unique.length ? unique : undefined;
}

export function normalizeExercisePrescriptionFields(
  value: unknown,
  fallbackCategory?: Exercise["category"],
): ExercisePrescriptionFieldKey[] {
  const parsed = parsePrescriptionFieldKeys(value);
  if (parsed.length) return parsed;
  return defaultPrescriptionFieldsForCategory(fallbackCategory ?? "Styrke");
}

/** Felt som skal lagres på øvelsen (alltid eksplisitt liste per øvelse). */
export function prescriptionFieldsForExerciseSave(
  fields: ExercisePrescriptionFieldKey[] | undefined,
  category: Exercise["category"],
): ExercisePrescriptionFieldKey[] {
  const normalized = fields?.length ? normalizeExercisePrescriptionFields(fields, category) : defaultPrescriptionFieldsForCategory(category);
  return normalized.length ? normalized : defaultPrescriptionFieldsForCategory(category);
}

export function defaultPrescriptionFieldsForCategory(category: Exercise["category"]): ExercisePrescriptionFieldKey[] {
  if (category === "Kondisjon") return ["minutes", "seconds", "pause"];
  if (isHoldBasedExerciseCategory(category)) return ["seconds", "pause"];
  return ["reps", "kg", "pause"];
}

/** Standard loggfelt når PT lager kondisjonsprogram uten intervalltimer. */
export function defaultLogAfterPrescriptionFields(): ExercisePrescriptionFieldKey[] {
  return ["minutes", "distance", "heartRate", "custom1"];
}

export function resolveProgramExerciseLogFields(
  programExercise: Pick<ProgramExercise, "logFieldKeys">,
  linkedExercise?: Pick<Exercise, "category" | "prescriptionFields">,
): ExercisePrescriptionFieldKey[] {
  if (programExercise.logFieldKeys?.length) return [...programExercise.logFieldKeys];
  if (linkedExercise?.category === "Kondisjon") return defaultLogAfterPrescriptionFields();
  return resolveExercisePrescriptionFields(linkedExercise);
}

export function buildProgramExerciseFromBankForLogAfter(exercise: Exercise): ProgramExercise {
  const row = buildProgramExerciseFromBank(exercise);
  return {
    ...row,
    sets: "1",
    logFieldKeys: defaultLogAfterPrescriptionFields(),
    durationMinutes: "",
    holdSeconds: "",
    speed: "",
    incline: "",
    restSeconds: "",
    customField1: "",
    customField2: "",
  };
}

export function resolveExercisePrescriptionFields(exercise?: Pick<Exercise, "category" | "prescriptionFields">): ExercisePrescriptionFieldKey[] {
  if (exercise?.prescriptionFields?.length) {
    return [...exercise.prescriptionFields];
  }
  return defaultPrescriptionFieldsForCategory(exercise?.category ?? "Styrke");
}

export function exercisePrescriptionFieldDef(key: ExercisePrescriptionFieldKey): ExercisePrescriptionFieldDef {
  return EXERCISE_PRESCRIPTION_FIELD_OPTIONS.find((option) => option.key === key)!;
}

export function resolvePrescriptionFieldLabel(
  key: ExercisePrescriptionFieldKey,
  exercise?: Pick<Exercise, "customField1Label" | "customField2Label">,
): string {
  if (key === "custom1") {
    const label = exercise?.customField1Label?.trim();
    return label || exercisePrescriptionFieldDef(key).label;
  }
  if (key === "custom2") {
    const label = exercise?.customField2Label?.trim();
    return label || exercisePrescriptionFieldDef(key).label;
  }
  return exercisePrescriptionFieldDef(key).label;
}

export function toggleExercisePrescriptionField(
  current: ExercisePrescriptionFieldKey[],
  key: ExercisePrescriptionFieldKey,
): ExercisePrescriptionFieldKey[] {
  if (current.includes(key)) {
    const next = current.filter((entry) => entry !== key);
    return next.length ? next : current;
  }
  const order = EXERCISE_PRESCRIPTION_FIELD_OPTIONS.map((option) => option.key);
  return [...current, key].sort((a, b) => order.indexOf(a) - order.indexOf(b));
}

export function buildProgramExerciseFromBank(exercise: Exercise): ProgramExercise {
  const fields = resolveExercisePrescriptionFields(exercise);
  const isTreadmill = exercise.equipment.trim().toLowerCase().includes("tredem");
  const row: ProgramExercise = {
    id: uid("draft-ex"),
    exerciseId: exercise.id,
    exerciseName: exercise.name,
    sets: fields.includes("seconds") && !fields.includes("reps") ? "2" : "3",
    reps: "",
    weight: "",
    holdSeconds: "",
    durationMinutes: "",
    distanceKm: "",
    seatSetting: "",
    customField1: "",
    customField2: "",
    speed: isTreadmill && exercise.category === "Kondisjon" ? "8" : "",
    incline: isTreadmill && exercise.category === "Kondisjon" ? "1" : "",
    restSeconds: fields.includes("pause") ? (fields.includes("seconds") && !fields.includes("reps") ? "30" : "90") : "",
    notes: "",
  };
  if (fields.includes("reps")) row.reps = fields.includes("seconds") && !fields.includes("kg") ? "1" : "10";
  if (fields.includes("kg")) row.weight = "0";
  if (fields.includes("seconds")) row.holdSeconds = "30";
  if (fields.includes("minutes")) row.durationMinutes = exercise.category === "Kondisjon" ? "20" : "";
  return row;
}

export function programExerciseFieldValue(item: ProgramExercise, key: ExercisePrescriptionFieldKey): string {
  const field = exercisePrescriptionFieldDef(key).programField;
  const raw = item[field];
  return typeof raw === "string" ? raw : "";
}

export function formatCustomPrescriptionSuffix(exercise: ProgramExercise, fieldKey: "custom1" | "custom2", label: string): string {
  const value = fieldKey === "custom1" ? exercise.customField1?.trim() : exercise.customField2?.trim();
  if (!value) return "";
  return ` · ${label} ${value}`;
}
