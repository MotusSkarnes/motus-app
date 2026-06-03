import { isHoldBasedExerciseCategory, programExerciseHoldSeconds } from "./exerciseCategories";
import {
  formatCustomPrescriptionSuffix,
  resolveExercisePrescriptionFields,
  resolvePrescriptionFieldLabel,
} from "./exercisePrescriptionFields";
import { CARDIO_COOLDOWN_STEP_NAME } from "./cardioEquipment";
import {
  EXERCISE_BLOCK_LABELS,
  isLegacyIntervalCooldownDrag,
  parseProgramSetCount,
  type WorkoutResultGroup,
} from "./programBlocks";
import { resolveWorkoutLoadUnit, resolveWorkoutRepsUnit } from "./workoutResultUnits";
import type { Exercise, ProgramExercise, TrainingProgram, WorkoutExerciseResult } from "./types";

export type WorkoutPlanLabelOptions = {
  /** Default true. False i øktmodus — plan fra program, ikke antall rader etter «Legg til sett». */
  useLiveSetCount?: boolean;
};

export type ProgramExercisePrescriptionOptions = {
  includePauseLabel?: boolean;
  /** Programbygger: kondisjon-fane uten Kondisjon-kategori i banken. */
  treatAsCardio?: boolean;
  /** Programbygger: mobilitet/rehab-fane. */
  treatAsHold?: boolean;
};

function appendCustomPrescriptionParts(row: ProgramExercise, bank?: Exercise): string {
  if (!bank) return "";
  const fields = resolveExercisePrescriptionFields(bank);
  let suffix = "";
  if (fields.includes("custom1")) {
    suffix += formatCustomPrescriptionSuffix(row, "custom1", resolvePrescriptionFieldLabel("custom1", bank));
  }
  if (fields.includes("custom2")) {
    suffix += formatCustomPrescriptionSuffix(row, "custom2", resolvePrescriptionFieldLabel("custom2", bank));
  }
  return suffix;
}

function cardioTargetHrPrescriptionSuffix(targetHrPercent: string | undefined): string {
  const raw = String(targetHrPercent ?? "").trim();
  if (!raw) return "";
  return ` · målpuls ca. ${raw}% av makspuls`;
}

export function resolveProgramExerciseName(rows: ProgramExercise[], index: number): string {
  return isLegacyIntervalCooldownDrag(rows, index) ? CARDIO_COOLDOWN_STEP_NAME : rows[index]?.exerciseName ?? "";
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
  options?: ProgramExercisePrescriptionOptions,
): string {
  const exerciseName = resolveProgramExerciseName(exercises, exerciseIndex);
  const linkedExercise = findLinkedExercise(exercise, exerciseName, exerciseLibrary);
  const category = linkedExercise?.category;
  const cardioMinutes = String(exercise.durationMinutes ?? "").trim();
  const cardioSeconds = String(exercise.holdSeconds ?? "").trim();
  const restSeconds = String(exercise.restSeconds ?? "").trim() || "0";
  const pauseLabel = options?.includePauseLabel ? " pause" : "";
  const isCardio = options?.treatAsCardio ?? (category === "Kondisjon" || Boolean(cardioMinutes));

  if (isCardio) {
    const dragLabel = /^drag\b/i.test(exerciseName.trim()) ? "drag" : "runder";
    const timeParts: string[] = [];
    if (cardioMinutes) timeParts.push(`${cardioMinutes} min`);
    if (cardioSeconds) timeParts.push(`${cardioSeconds} sek`);
    const timeLabel = timeParts.length ? timeParts.join(" ") : "—";
    return `${exercise.sets || "-"} ${dragLabel} × ${timeLabel}${exercise.speed ? ` · ${exercise.speed} km/t` : ""}${exercise.incline ? ` · ${exercise.incline}% incline` : ""} · ${restSeconds}s${pauseLabel}${cardioTargetHrPrescriptionSuffix(exercise.targetHrPercent)}${appendCustomPrescriptionParts(exercise, linkedExercise)}`;
  }

  const isHold =
    options?.treatAsHold ?? Boolean(category && isHoldBasedExerciseCategory(category));
  if (isHold && category) {
    return `${exercise.sets || "-"} sett × ${programExerciseHoldSeconds(exercise, category) || "-"} sek · ${restSeconds}s${pauseLabel}${appendCustomPrescriptionParts(exercise, linkedExercise)}`;
  }
  if (isHold) {
    const hold = programExerciseHoldSeconds(exercise, undefined) || exercise.holdSeconds || exercise.weight || "-";
    return `${exercise.sets || "-"} sett × ${hold} sek · ${restSeconds}s${pauseLabel}${appendCustomPrescriptionParts(exercise, linkedExercise)}`;
  }

  const repsUnit = exercise.repsUnit === "minutes" ? "min" : "reps";
  const weightUnit = exercise.weightUnit === "seconds" ? "sek" : "kg";
  const seatSuffix = exercise.seatSetting?.trim() ? ` · sete ${exercise.seatSetting.trim()}` : "";
  return `${exercise.sets || "-"}×${exercise.reps || "-"} ${repsUnit} · ${exercise.weight || "0"} ${weightUnit} · ${restSeconds}s${pauseLabel}${seatSuffix}${appendCustomPrescriptionParts(exercise, linkedExercise)}`;
}

function workoutRowsToProgramExercise(rows: WorkoutExerciseResult[]): ProgramExercise | null {
  const row = rows[0];
  if (!row) return null;
  const isHold =
    row.plannedWeightUnit === "seconds" ||
    Boolean(row.exerciseCategory && isHoldBasedExerciseCategory(row.exerciseCategory));
  return {
    id: row.programExerciseId ?? row.exerciseId,
    exerciseId: row.exerciseId,
    exerciseName: row.exerciseName,
    sets: String(row.plannedSets?.trim() || "1"),
    reps: row.plannedReps,
    repsUnit: row.plannedRepsUnit,
    weight: isHold ? "" : row.plannedWeight,
    weightUnit: row.plannedWeightUnit,
    holdSeconds: isHold ? row.plannedWeight : undefined,
    durationMinutes: row.plannedDurationMinutes,
    speed: row.plannedSpeed,
    incline: row.plannedIncline,
    restSeconds: "",
    notes: "",
  };
}

/** Økt-rader (planlagt vekt/reps) slås sammen med programøvelse for visning — matcher Plan-kolonnen i øktmodus. */
function mergeProgramExerciseWithWorkoutRows(
  programExercise: ProgramExercise | undefined,
  rows: WorkoutExerciseResult[],
  options?: WorkoutPlanLabelOptions,
): ProgramExercise | null {
  const fromRows = workoutRowsToProgramExercise(rows);
  if (!fromRows) return programExercise ?? null;
  if (!programExercise) return fromRows;
  const plannedSets = Number(String(programExercise.sets ?? "").trim()) || 0;
  const liveSetCount = rows.length;
  const useLiveSetCount = options?.useLiveSetCount === true;
  const sets =
    useLiveSetCount && liveSetCount > plannedSets
      ? String(liveSetCount)
      : String(programExercise.sets || fromRows.sets);
  return {
    ...programExercise,
    sets,
    reps: fromRows.reps || programExercise.reps,
    repsUnit: fromRows.repsUnit ?? programExercise.repsUnit,
    weight: fromRows.weight || programExercise.weight,
    weightUnit: fromRows.weightUnit ?? programExercise.weightUnit,
    holdSeconds: fromRows.holdSeconds ?? programExercise.holdSeconds,
    durationMinutes: fromRows.durationMinutes || programExercise.durationMinutes,
    speed: fromRows.speed || programExercise.speed,
    incline: fromRows.incline || programExercise.incline,
  };
}

function formatPlanFromWorkoutRows(
  rows: WorkoutExerciseResult[],
  program: TrainingProgram | null | undefined,
  programExerciseId: string,
  exerciseLibrary: Exercise[],
  options?: WorkoutPlanLabelOptions,
): string {
  if (!rows.length) return "";
  const programExercise = program?.exercises.find((exercise) => exercise.id === programExerciseId);
  const exerciseIndex = program?.exercises.findIndex((exercise) => exercise.id === programExerciseId) ?? -1;
  const merged = mergeProgramExerciseWithWorkoutRows(programExercise, rows, options);
  if (!merged) return "";
  const useLiveSetCount = options?.useLiveSetCount === true;
  const liveSetCount = useLiveSetCount ? rows.length : undefined;
  if (program && exerciseIndex >= 0) {
    return formatPrescriptionForProgramExercise(
      merged,
      exerciseIndex,
      program.exercises,
      exerciseLibrary,
      liveSetCount,
    );
  }
  return formatProgramExercisePrescription(merged, 0, [merged], exerciseLibrary);
}

function formatPrescriptionForProgramExercise(
  programExercise: ProgramExercise,
  exerciseIndex: number,
  programExercises: ProgramExercise[],
  exerciseLibrary: Exercise[],
  liveSetCount?: number,
): string {
  const plannedSets = parseProgramSetCount(programExercise.sets);
  const adjusted =
    liveSetCount && liveSetCount > plannedSets ? { ...programExercise, sets: String(liveSetCount) } : programExercise;
  return formatProgramExercisePrescription(adjusted, exerciseIndex, programExercises, exerciseLibrary);
}

/** Planlinje for en øvelse/gruppe i live-økt — samme format som programforhåndsvisning. */
export function formatWorkoutGroupPlanLabel(
  group: Pick<WorkoutResultGroup, "groupId" | "blockType" | "blockRounds" | "exerciseNames" | "rows" | "rounds">,
  program: TrainingProgram | null | undefined,
  exerciseLibrary: Exercise[],
  options?: WorkoutPlanLabelOptions,
): string {
  if (group.blockType) {
    const label = EXERCISE_BLOCK_LABELS[group.blockType];
    const rounds = group.blockRounds ?? group.rounds.length;
    const names = group.exerciseNames.join(" → ");
    return names
      ? `${label} · ${rounds} runde${rounds === 1 ? "" : "r"} · ${names}`
      : `${label} · ${rounds} runde${rounds === 1 ? "" : "r"}`;
  }

  return formatPlanFromWorkoutRows(group.rows, program, group.groupId, exerciseLibrary, options);
}

/** Plan for ett segment i supersett/trisett/sirkel. */
export function formatWorkoutSegmentPlanLabel(
  programExerciseId: string,
  segmentRows: WorkoutExerciseResult[],
  program: TrainingProgram | null | undefined,
  exerciseLibrary: Exercise[],
  options?: WorkoutPlanLabelOptions,
): string {
  return formatPlanFromWorkoutRows(segmentRows, program, programExerciseId, exerciseLibrary, options);
}

export function resolveWorkoutGroupExerciseName(
  group: Pick<WorkoutResultGroup, "groupId" | "exerciseName">,
  program: TrainingProgram | null | undefined,
): string {
  if (!program) return group.exerciseName;
  const exerciseIndex = program.exercises.findIndex((exercise) => exercise.id === group.groupId);
  if (exerciseIndex < 0) return group.exerciseName;
  return resolveProgramExerciseName(program.exercises, exerciseIndex);
}

function findLinkedExerciseForResult(result: WorkoutExerciseResult, exerciseLibrary: Exercise[]): Exercise | undefined {
  const byId = exerciseLibrary.find((item) => item.id === result.exerciseId);
  if (byId) return byId;
  const normalizedName = result.exerciseName.trim().toLowerCase();
  if (!normalizedName) return undefined;
  return exerciseLibrary.find((item) => item.name.trim().toLowerCase() === normalizedName);
}

function resultIsCardio(result: WorkoutExerciseResult, linked?: Exercise): boolean {
  return linked?.category === "Kondisjon" || result.exerciseCategory === "Kondisjon" || Boolean(result.plannedDurationMinutes?.trim());
}

function resultIsHold(result: WorkoutExerciseResult, linked?: Exercise): boolean {
  const category = linked?.category ?? result.exerciseCategory;
  return Boolean(category && isHoldBasedExerciseCategory(category));
}

/** Plan for ett logget sett (volum per sett, samme språk som programmet). */
export function formatWorkoutResultSetPlanLabel(result: WorkoutExerciseResult, exerciseLibrary: Exercise[] = []): string {
  const linked = findLinkedExerciseForResult(result, exerciseLibrary);
  if (resultIsCardio(result, linked)) {
    const parts: string[] = [];
    const minutes = String(result.plannedDurationMinutes ?? "").trim();
    if (minutes) parts.push(`${minutes} min`);
    if (result.plannedSpeed?.trim()) parts.push(`${result.plannedSpeed} km/t`);
    if (result.plannedIncline?.trim()) parts.push(`${result.plannedIncline}% incline`);
    return parts.length ? parts.join(" · ") : "—";
  }
  if (resultIsHold(result, linked)) {
    return `${result.plannedWeight || "—"} sek`;
  }
  const repsUnit = resolveWorkoutRepsUnit(result) === "min" ? "min" : "reps";
  const loadUnit = resolveWorkoutLoadUnit(result) === "sec" ? "sek" : "kg";
  return `${result.plannedReps || "—"} ${repsUnit} · ${result.plannedWeight || "0"} ${loadUnit}`;
}

/** Full plan for en øvelse i treningslogg (alle sett for samme programExerciseId). */
export function formatWorkoutResultExercisePlanLabel(
  rows: WorkoutExerciseResult[],
  exerciseLibrary: Exercise[] = [],
): string {
  const pseudo = workoutRowsToProgramExercise(rows);
  if (!pseudo) return "";
  const linked = rows[0] ? findLinkedExerciseForResult(rows[0], exerciseLibrary) : undefined;
  return formatProgramExercisePrescription(pseudo, 0, [pseudo], linked ? [linked] : [], {
    treatAsCardio: rows[0] ? resultIsCardio(rows[0], linked) : false,
    treatAsHold: rows[0] ? resultIsHold(rows[0], linked) : false,
  });
}

/** Utført volum for ett logget sett. */
export function formatWorkoutResultPerformedLabel(result: WorkoutExerciseResult, exerciseLibrary: Exercise[] = []): string {
  const linked = findLinkedExerciseForResult(result, exerciseLibrary);
  if (resultIsCardio(result, linked)) {
    const parts: string[] = [];
    const minutes = String(result.performedDurationMinutes ?? "").trim();
    if (minutes) parts.push(`${minutes} min`);
    else parts.push("—");
    if (result.performedSpeed?.trim()) parts.push(`${result.performedSpeed} km/t`);
    if (result.performedIncline?.trim()) parts.push(`${result.performedIncline}% incline`);
    return parts.join(" · ");
  }
  const loadUnit = resolveWorkoutLoadUnit(result);
  if (resultIsHold(result, linked) || loadUnit === "sec") {
    return `${result.performedWeight || "—"} sek`;
  }
  const repsUnit = resolveWorkoutRepsUnit(result) === "min" ? "min" : "reps";
  return `${result.performedReps || "—"} ${repsUnit} · ${result.performedWeight || "—"} kg`;
}
