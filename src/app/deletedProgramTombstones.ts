import { buildTrainingProgramDisplayKey } from "./programBlocks";
import type { TrainingProgram } from "./types";

const deletedProgramIds = new Set<string>();
const deletedProgramFingerprints = new Set<string>();

export function registerDeletedProgram(program: Pick<TrainingProgram, "id" | "title" | "goal" | "notes" | "exercises">): void {
  const id = program.id?.trim();
  if (id) deletedProgramIds.add(id);
  deletedProgramFingerprints.add(buildTrainingProgramDisplayKey(program));
}

export function unregisterDeletedProgram(programId: string): void {
  const id = programId.trim();
  if (id) deletedProgramIds.delete(id);
}

export function isProgramDeleted(program: TrainingProgram): boolean {
  const id = program.id?.trim();
  if (id && deletedProgramIds.has(id)) return true;
  return deletedProgramFingerprints.has(buildTrainingProgramDisplayKey(program));
}

export function filterDeletedPrograms(programs: TrainingProgram[]): TrainingProgram[] {
  return programs.filter((program) => !isProgramDeleted(program));
}
