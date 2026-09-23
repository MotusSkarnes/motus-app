import { sanitizeProgramExerciseForLogAfter } from "./exercisePrescriptionFields";
import type { ProgramExercise, TrainingProgram } from "./types";

export { sanitizeProgramExerciseForLogAfter } from "./exercisePrescriptionFields";

export type ConditioningDeliveryMode = "interval" | "logAfter";

const CONDITIONING_MODE_PREFIX = /^__motusConditioningMode=(interval|logAfter)(?:\r?\n|$)/;

export function parseConditioningDeliveryMode(
  program: Pick<TrainingProgram, "notes" | "conditioningDeliveryMode">,
): ConditioningDeliveryMode | null {
  const stored = program.conditioningDeliveryMode;
  if (stored === "interval" || stored === "logAfter") return stored;
  const match = String(program.notes ?? "").match(CONDITIONING_MODE_PREFIX);
  if (!match) return null;
  return match[1] as ConditioningDeliveryMode;
}

export function stripConditioningModeMarker(notes: string): string {
  return notes.replace(CONDITIONING_MODE_PREFIX, "").trim();
}

export function buildConditioningProgramNotes(mode: ConditioningDeliveryMode, description: string): string {
  const body = description.trim();
  return body ? `__motusConditioningMode=${mode}\n${body}` : `__motusConditioningMode=${mode}`;
}

/** Fjern logg-etter-økt felt når programmet skal kjøres som intervalltimer. */
export function stripLogFieldKeysFromExercises(exercises: ProgramExercise[]): ProgramExercise[] {
  return exercises.map((exercise) => {
    if (!exercise.logFieldKeys?.length) return exercise;
    const { logFieldKeys: _removed, ...rest } = exercise;
    return rest;
  });
}

export function enrichProgramWithConditioningMode(program: TrainingProgram): TrainingProgram {
  const mode = resolveConditioningDeliveryMode(program);
  if (!mode) return program;
  const exercises =
    mode === "logAfter"
      ? sanitizeProgramExercisesForLogAfter(program.exercises)
      : stripLogFieldKeysFromExercises(program.exercises);
  return {
    ...program,
    conditioningDeliveryMode: mode,
    notes: stripConditioningModeMarker(program.notes),
    exercises,
  };
}

/** Minst én øvelse har eksplisitt valgte loggfelt (lagres i exercises-json). */
export function programHasConfiguredLogAfterFields(
  program: Pick<TrainingProgram, "exercises">,
): boolean {
  return program.exercises.some(
    (exercise) => Array.isArray(exercise.logFieldKeys) && exercise.logFieldKeys.length > 0,
  );
}

export function resolveConditioningDeliveryMode(
  program: Pick<TrainingProgram, "notes" | "conditioningDeliveryMode" | "exercises">,
): ConditioningDeliveryMode | null {
  const explicit = parseConditioningDeliveryMode(program);
  if (explicit) return explicit;
  if (programHasConfiguredLogAfterFields(program)) return "logAfter";
  return null;
}

/** Eksplisitt logg-etter-økt (ikke intervalltimer). */
export function isConditioningLogAfterProgram(
  program: Pick<TrainingProgram, "notes" | "conditioningDeliveryMode" | "exercises">,
): boolean {
  return resolveConditioningDeliveryMode(program) === "logAfter";
}

/** Eksplisitt intervalløkt med nedtelling. */
export function isConditioningIntervalProgram(
  program: Pick<TrainingProgram, "notes" | "conditioningDeliveryMode">,
): boolean {
  return parseConditioningDeliveryMode(program) === "interval";
}

/** Bygg notes for lagring/sync når modus ligger i minnet men er strippet fra notes. */
export function serializeConditioningProgramNotes(
  program: Pick<TrainingProgram, "notes" | "conditioningDeliveryMode" | "exercises">,
): string {
  const mode = resolveConditioningDeliveryMode(program);
  const body = stripConditioningModeMarker(program.notes);
  if (!mode) return body;
  return buildConditioningProgramNotes(mode, body);
}

export function sanitizeProgramExercisesForLogAfter(exercises: ProgramExercise[]): ProgramExercise[] {
  return exercises.map((exercise) => sanitizeProgramExerciseForLogAfter(exercise));
}
