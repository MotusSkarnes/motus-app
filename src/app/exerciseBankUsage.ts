import type { Exercise, Member, ProgramExercise, TrainingProgram } from "./types";

export type ProgramExerciseUsage = {
  programId: string;
  programTitle: string;
  memberId: string;
  memberName: string;
};

function normalizeExerciseName(value: string): string {
  return value.trim().toLowerCase();
}

export function programExerciseUsesBankExercise(
  programExercise: ProgramExercise,
  exercise: Pick<Exercise, "id" | "name">,
): boolean {
  if (programExercise.exerciseId === exercise.id) return true;
  const bankName = normalizeExerciseName(exercise.name);
  if (!bankName) return false;
  return normalizeExerciseName(programExercise.exerciseName) === bankName;
}

export function findProgramsUsingBankExercise(
  programs: TrainingProgram[],
  members: Member[],
  exercise: Pick<Exercise, "id" | "name">,
): ProgramExerciseUsage[] {
  const memberNameById = new Map(members.map((member) => [member.id, member.name.trim() || "Ukjent kunde"]));
  const seenProgramIds = new Set<string>();
  const usages: ProgramExerciseUsage[] = [];

  for (const program of programs) {
    if (seenProgramIds.has(program.id)) continue;
    const isUsed = program.exercises.some((item) => programExerciseUsesBankExercise(item, exercise));
    if (!isUsed) continue;
    seenProgramIds.add(program.id);
    usages.push({
      programId: program.id,
      programTitle: program.title.trim() || "Uten tittel",
      memberId: program.memberId,
      memberName: memberNameById.get(program.memberId) ?? "Ukjent kunde",
    });
  }

  return usages.sort((a, b) => a.programTitle.localeCompare(b.programTitle, "nb"));
}

export function buildDeleteExerciseFromBankDialogCopy(
  exerciseName: string,
  usages: ProgramExerciseUsage[],
): { title: string; message: string; confirmLabel: string } {
  const label = exerciseName.trim() || "øvelsen";
  if (!usages.length) {
    return {
      title: "Fjerne øvelse",
      message: `Fjerne «${label}» fra øvelsesbanken?`,
      confirmLabel: "Fjern øvelse",
    };
  }

  const preview = usages.slice(0, 6).map((row) => `• ${row.programTitle} (${row.memberName})`);
  const overflow =
    usages.length > preview.length ? `\n… og ${usages.length - preview.length} program til` : "";

  return {
    title: "Øvelsen ligger i treningsprogram",
    message: [
      `«${label}» er lagt inn i ${usages.length} treningsprogram:`,
      "",
      ...preview,
      overflow,
      "",
      "Hvis du fjerner øvelsen, forsvinner den fra øvelsesbanken og fra disse programmene.",
      "Vil du fortsette?",
    ].join("\n"),
    confirmLabel: "Fjern likevel",
  };
}

export function filterProgramExercisesAfterBankDelete(
  exercises: ProgramExercise[],
  deletedExercise: Pick<Exercise, "id" | "name">,
): ProgramExercise[] {
  return exercises.filter((item) => !programExerciseUsesBankExercise(item, deletedExercise));
}
