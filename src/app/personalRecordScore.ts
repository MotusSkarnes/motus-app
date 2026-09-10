import { estimate1RmKg } from "./personalRecordProgress";
import { exerciseBankUsesSecondsLoad, resolveExercisePrescriptionFields } from "./exercisePrescriptionFields";
import { resolveWorkoutLoadUnit } from "./workoutResultUnits";
import type { Exercise, WorkoutExerciseResult, WorkoutLog } from "./types";

export type PersonalRecordKind = "oneRm" | "seconds" | "reps";

type RecordResult = Pick<
  WorkoutExerciseResult,
  "performedLoadUnit" | "plannedWeightUnit" | "exerciseCategory" | "performedWeight" | "performedReps"
>;

export function resolvePersonalRecordKind(
  row: RecordResult,
  linked?: Pick<Exercise, "category" | "prescriptionFields">,
): PersonalRecordKind | null {
  if (row.exerciseCategory === "Kondisjon" || linked?.category === "Kondisjon") return null;
  // Bank/programstyring vinner over gamle rader som ble lagret som kg × leftover reps.
  if (linked && exerciseBankUsesSecondsLoad(linked)) return "seconds";
  if (linked) {
    const fields = resolveExercisePrescriptionFields(linked);
    if (fields.includes("reps") && !fields.includes("kg") && !fields.includes("seconds")) return "reps";
  }
  if (resolveWorkoutLoadUnit(row) === "sec") return "seconds";
  const weight = parseRecordNumber(row.performedWeight);
  const reps = parseRecordNumber(row.performedReps);
  if (weight <= 0 && reps > 0) return "reps";
  if (weight > 0 && reps > 0) return "oneRm";
  return null;
}

export function personalRecordScore(row: RecordResult, kind: PersonalRecordKind): number {
  const weight = parseRecordNumber(row.performedWeight);
  const reps = parseRecordNumber(row.performedReps);
  if (kind === "seconds") return weight > 0 ? weight : 0;
  if (kind === "reps") return reps > 0 ? reps : 0;
  if (resolveWorkoutLoadUnit(row) === "sec") return 0;
  return estimate1RmKg(weight, reps);
}

export function personalRecordMapKey(exerciseName: string, kind: PersonalRecordKind): string {
  return `${exerciseName.trim().toLowerCase()}::${kind}`;
}

export function bestPersonalRecordScoreForExercise(
  logs: WorkoutLog[],
  exerciseName: string,
  kind: PersonalRecordKind,
  memberId?: string,
): number {
  const normalized = exerciseName.trim().toLowerCase();
  let best = 0;
  logs.forEach((log) => {
    if (memberId && log.memberId !== memberId) return;
    (log.results ?? []).forEach((result) => {
      if (!result.completed) return;
      if (result.exerciseName.trim().toLowerCase() !== normalized) return;
      const score = personalRecordScore(result, kind);
      if (score > best) best = score;
    });
  });
  return best;
}

export function formatPersonalRecordScore(kind: PersonalRecordKind, score: number): string {
  if (kind === "seconds") return `${formatWholeOrOneDecimal(score)} sek`;
  if (kind === "reps") return `${formatWholeOrOneDecimal(score)} reps`;
  return `${score.toFixed(1)} kg`;
}

export function formatPersonalRecordSetSummary(kind: PersonalRecordKind, weight: number, reps: number): string {
  if (kind === "seconds") return `${formatWholeOrOneDecimal(weight)} sek`;
  if (kind === "reps") return `${formatWholeOrOneDecimal(reps)} reps`;
  return `${weight} kg × ${reps} reps`;
}

export function personalRecordKindLabel(kind: PersonalRecordKind): string {
  if (kind === "seconds") return "Lengste hold";
  if (kind === "reps") return "Flest reps";
  return "1RM (estimat)";
}

function parseRecordNumber(value: string | undefined): number {
  const n = Number(String(value ?? "").replace(",", ".").trim());
  return Number.isFinite(n) ? n : 0;
}

function formatWholeOrOneDecimal(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 10) / 10);
}
