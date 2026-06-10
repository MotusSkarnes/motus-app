import type { TrainingProgram } from "./types";

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

export function enrichProgramWithConditioningMode(program: TrainingProgram): TrainingProgram {
  const mode = parseConditioningDeliveryMode(program);
  if (!mode) return program;
  return {
    ...program,
    conditioningDeliveryMode: mode,
    notes: stripConditioningModeMarker(program.notes),
  };
}

/** Eksplisitt logg-etter-økt (ikke intervalltimer). */
export function isConditioningLogAfterProgram(
  program: Pick<TrainingProgram, "notes" | "conditioningDeliveryMode">,
): boolean {
  return parseConditioningDeliveryMode(program) === "logAfter";
}

/** Eksplisitt intervalløkt med nedtelling. */
export function isConditioningIntervalProgram(
  program: Pick<TrainingProgram, "notes" | "conditioningDeliveryMode">,
): boolean {
  return parseConditioningDeliveryMode(program) === "interval";
}
