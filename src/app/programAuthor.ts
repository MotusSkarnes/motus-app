import type { TrainingProgram } from "./types";

export type ResolvedProgramAuthor = "member" | "trainer" | "unknown";

function pickFirstName(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const firstToken = trimmed.split(/\s+/)[0] ?? "";
  return firstToken.trim();
}

/** Behold trener-opphav ved duplikat-merge (nyere rad kan mangle felt etter delvis fetch). */
export function mergeProgramAuthorFields(
  primary: TrainingProgram,
  secondary: TrainingProgram,
): Pick<TrainingProgram, "programCreatedBy" | "programCreatedByName" | "ownerUserId" | "assignedTrainerName"> {
  const candidates = [primary, secondary];
  const trainer = candidates.find((p) => p.programCreatedBy === "trainer");
  if (trainer) {
    return {
      programCreatedBy: "trainer",
      programCreatedByName: trainer.programCreatedByName ?? secondary.programCreatedByName ?? primary.programCreatedByName,
      ownerUserId: trainer.ownerUserId ?? secondary.ownerUserId ?? primary.ownerUserId,
      assignedTrainerName: trainer.assignedTrainerName ?? secondary.assignedTrainerName ?? primary.assignedTrainerName,
    };
  }
  const withOwner = candidates.find((p) => p.ownerUserId?.trim());
  const withAuthor = candidates.find((p) => p.programCreatedBy);
  const pick = withAuthor ?? withOwner ?? primary;
  return {
    programCreatedBy: pick.programCreatedBy,
    programCreatedByName: pick.programCreatedByName,
    ownerUserId: pick.ownerUserId ?? secondary.ownerUserId ?? primary.ownerUserId,
    assignedTrainerName: pick.assignedTrainerName ?? secondary.assignedTrainerName ?? primary.assignedTrainerName,
  };
}

/**
 * PT-programmer kan ha program_created_by=member i DB (feil JWT-rolle ved lagring).
 * owner_user_id ≠ medlemmets auth-id tyder på trener-eid rad.
 */
export function resolveProgramAuthorKind(
  program: TrainingProgram,
  options?: { viewerAuthUserId?: string },
): ResolvedProgramAuthor {
  const viewerAuthUserId = options?.viewerAuthUserId?.trim() ?? "";
  const ownerUserId = program.ownerUserId?.trim() ?? "";
  if (program.programCreatedBy === "trainer") return "trainer";
  if (program.programCreatedBy === "member") {
    if (viewerAuthUserId && ownerUserId && ownerUserId !== viewerAuthUserId) return "trainer";
    return "member";
  }
  if (program.assignedTrainerName?.trim()) return "trainer";
  if (viewerAuthUserId && ownerUserId && ownerUserId !== viewerAuthUserId) return "trainer";
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
  const legacy = program.assignedTrainerName?.trim();
  if (legacy) return `Fra trener ${pickFirstName(legacy)}`;
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
