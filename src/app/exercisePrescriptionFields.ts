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
];

const FIELD_KEYS = new Set(EXERCISE_PRESCRIPTION_FIELD_OPTIONS.map((option) => option.key));

export function normalizeExercisePrescriptionFields(
  value: unknown,
  fallbackCategory?: Exercise["category"],
): ExercisePrescriptionFieldKey[] {
  if (!Array.isArray(value)) {
    return defaultPrescriptionFieldsForCategory(fallbackCategory ?? "Styrke");
  }
  const normalized = value
    .map((entry) => String(entry ?? "").trim())
    .filter((entry): entry is ExercisePrescriptionFieldKey => FIELD_KEYS.has(entry as ExercisePrescriptionFieldKey));
  const unique = Array.from(new Set(normalized));
  if (unique.length) return unique;
  return defaultPrescriptionFieldsForCategory(fallbackCategory ?? "Styrke");
}

export function defaultPrescriptionFieldsForCategory(category: Exercise["category"]): ExercisePrescriptionFieldKey[] {
  if (category === "Kondisjon") return ["minutes", "seconds", "pause"];
  if (isHoldBasedExerciseCategory(category)) return ["seconds", "pause"];
  return ["reps", "kg", "pause"];
}

export function resolveExercisePrescriptionFields(exercise?: Pick<Exercise, "category" | "prescriptionFields">): ExercisePrescriptionFieldKey[] {
  if (exercise?.prescriptionFields?.length) {
    return normalizeExercisePrescriptionFields(exercise.prescriptionFields, exercise.category);
  }
  return defaultPrescriptionFieldsForCategory(exercise?.category ?? "Styrke");
}

export function exercisePrescriptionFieldDef(key: ExercisePrescriptionFieldKey): ExercisePrescriptionFieldDef {
  return EXERCISE_PRESCRIPTION_FIELD_OPTIONS.find((option) => option.key === key)!;
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
    seatSetting: "",
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
