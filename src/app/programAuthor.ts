import type { TrainingProgram } from "./types";

export type ResolvedProgramAuthor = "member" | "trainer" | "unknown";

function pickFirstName(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const firstToken = trimmed.split(/\s+/)[0] ?? "";
  return firstToken.trim();
}

/** Behold eksplisitt opphav ved duplikat-merge; ikke overskriv member med trainer pga. owner_user_id. */
export function mergeProgramAuthorFields(
  primary: TrainingProgram,
  secondary: TrainingProgram,
): Pick<TrainingProgram, "programCreatedBy" | "programCreatedByName" | "ownerUserId" | "assignedTrainerName"> {
  if (primary.programCreatedBy === "member" || primary.programCreatedBy === "trainer") {
    return {
      programCreatedBy: primary.programCreatedBy,
      programCreatedByName: primary.programCreatedByName ?? secondary.programCreatedByName,
      ownerUserId: primary.ownerUserId ?? secondary.ownerUserId,
      assignedTrainerName: primary.assignedTrainerName ?? secondary.assignedTrainerName,
    };
  }
  if (secondary.programCreatedBy === "member" || secondary.programCreatedBy === "trainer") {
    return {
      programCreatedBy: secondary.programCreatedBy,
      programCreatedByName: secondary.programCreatedByName ?? primary.programCreatedByName,
      ownerUserId: secondary.ownerUserId ?? primary.ownerUserId,
      assignedTrainerName: secondary.assignedTrainerName ?? primary.assignedTrainerName,
    };
  }
  const trainer = [primary, secondary].find((p) => p.programCreatedBy === "trainer");
  if (trainer) {
    return {
      programCreatedBy: "trainer",
      programCreatedByName: trainer.programCreatedByName ?? secondary.programCreatedByName ?? primary.programCreatedByName,
      ownerUserId: trainer.ownerUserId ?? secondary.ownerUserId ?? primary.ownerUserId,
      assignedTrainerName: trainer.assignedTrainerName ?? secondary.assignedTrainerName ?? primary.assignedTrainerName,
    };
  }
  return {
    programCreatedBy: primary.programCreatedBy ?? secondary.programCreatedBy,
    programCreatedByName: primary.programCreatedByName ?? secondary.programCreatedByName,
    ownerUserId: primary.ownerUserId ?? secondary.ownerUserId,
    assignedTrainerName: primary.assignedTrainerName ?? secondary.assignedTrainerName,
  };
}

/**
 * Viser hvem som opprettet programmet. owner_user_id er PT for alle kundeer (RLS) og brukes ikke her.
 * Uten program_created_by: eldre rader kan vises som trener hvis assigned_trainer_name finnes.
 */
export function resolveProgramAuthorKind(
  program: TrainingProgram,
  _options?: { viewerAuthUserId?: string },
): ResolvedProgramAuthor {
  if (program.programCreatedBy === "trainer") return "trainer";
  if (program.programCreatedBy === "member") return "member";
  if (program.assignedTrainerName?.trim()) return "trainer";
  return "unknown";
}

export function programAuthorCreditForMember(
  program: TrainingProgram,
  options?: { viewerAuthUserId?: string },
): string | null {
  const kind = resolveProgramAuthorKind(program, options);
  if (kind === "member") return "Lagret av deg";
  if (kind === "trainer") {
    const n = program.programCreatedByName?.trim() || program.assignedTrainerName?.trim();
    return n ? `Fra trener ${pickFirstName(n)}` : "Fra trener";
  }
  return null;
}

export function programAuthorLabelForTrainer(program: TrainingProgram): string | null {
  if (program.programCreatedBy === "member") {
    const memberName = pickFirstName(program.programCreatedByName ?? "");
    return memberName ? `Lagret av medlem ${memberName}` : "Lagret av medlem";
  }
  if (program.programCreatedBy === "trainer") {
    const trainerName = pickFirstName(program.programCreatedByName ?? "");
    return trainerName ? `Lagret av trener ${trainerName}` : "Lagret av trener";
  }
  const legacyTrainer = program.assignedTrainerName?.trim();
  return legacyTrainer ? `Lagret av trener ${pickFirstName(legacyTrainer)}` : null;
}

export function memberMayDeleteProgram(
  program: TrainingProgram,
  options?: { viewerAuthUserId?: string },
): boolean {
  return resolveProgramAuthorKind(program, options) === "member";
}
