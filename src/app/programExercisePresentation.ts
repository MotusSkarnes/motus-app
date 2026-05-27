import { isHoldBasedExerciseCategory, programExerciseHoldSeconds } from "./exerciseCategories";
import { isLegacyIntervalCooldownDrag } from "./programBlocks";
import type { Exercise, ProgramExercise } from "./types";

function cardioTargetHrPrescriptionSuffix(targetHrPercent: string | undefined): string {
  const raw = String(targetHrPercent ?? "").trim();
  if (!raw) return "";
  return ` · målpuls ca. ${raw}% av makspuls`;
}

export function resolveProgramExerciseName(rows: ProgramExercise[], index: number): string {
  return isLegacyIntervalCooldownDrag(rows, index) ? "Nedjogg" : rows[index]?.exerciseName ?? "";
}

function findLinkedExercise(
  exercise: ProgramExercise,
  exerciseName: string,
  exerciseLibrary: Exercise[],
): Exercise | undefined {
  const byId = exerciseLibrary.find((item) => item.id === exercise.exerciseId);
  if (byId) return byId;
  const normalizedName = exerciseName.trim().toLowerCase();
  if (!normalizedName) return undefined;
  return exerciseLibrary.find((item) => item.name.trim().toLowerCase() === normalizedName);
}

export function formatProgramExercisePrescription(
  exercise: ProgramExercise,
  exerciseIndex: number,
  exercises: ProgramExercise[],
  exerciseLibrary: Exercise[],
  options?: { includePauseLabel?: boolean },
): string {
  const exerciseName = resolveProgramExerciseName(exercises, exerciseIndex);
  const linkedExercise = findLinkedExercise(exercise, exerciseName, exerciseLibrary);
  const category = linkedExercise?.category;
  const cardioMinutes = String(exercise.durationMinutes ?? "").trim();
  const cardioSeconds = String(exercise.holdSeconds ?? "").trim();
  const restSeconds = String(exercise.restSeconds ?? "").trim() || "0";
  const pauseLabel = options?.includePauseLabel ? " pause" : "";
  const isCardio = category === "Kondisjon" || Boolean(cardioMinutes);

  if (isCardio) {
    const dragLabel = /^drag\b/i.test(exerciseName.trim()) ? "drag" : "runder";
    const timeParts: string[] = [];
    if (cardioMinutes) timeParts.push(`${cardioMinutes} min`);
    if (cardioSeconds) timeParts.push(`${cardioSeconds} sek`);
    const timeLabel = timeParts.length ? timeParts.join(" ") : "—";
    return `${exercise.sets || "-"} ${dragLabel} × ${timeLabel}${exercise.speed ? ` · ${exercise.speed} km/t` : ""}${exercise.incline ? ` · ${exercise.incline}% incline` : ""} · ${restSeconds}s${pauseLabel}${cardioTargetHrPrescriptionSuffix(exercise.targetHrPercent)}`;
  }

  if (category && isHoldBasedExerciseCategory(category)) {
    return `${exercise.sets || "-"} sett × ${programExerciseHoldSeconds(exercise, category) || "-"} sek · ${restSeconds}s${pauseLabel}`;
  }

  const repsUnit = exercise.repsUnit === "minutes" ? "min" : "reps";
  const weightUnit = exercise.weightUnit === "seconds" ? "sek" : "kg";
  return `${exercise.sets || "-"}×${exercise.reps || "-"} ${repsUnit} · ${exercise.weight || "0"} ${weightUnit} · ${restSeconds}s${pauseLabel}`;
}
