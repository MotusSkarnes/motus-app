import { describe, expect, it } from "vitest";
import { formatProgramExercisePrescription } from "./programExercisePresentation";
import type { Exercise, ProgramExercise, TrainingProgram } from "./types";

function printField(value: unknown): string {
  return String(value ?? "").trim();
}

function buildMemberPrintPrescription(
  safeExercise: Partial<ProgramExercise>,
  libraryMatch: Exercise | null,
): string {
  const exercise = safeExercise as ProgramExercise;
  const library = libraryMatch ? [libraryMatch] : [];
  return formatProgramExercisePrescription(exercise, 0, [exercise], library, {
    includePauseLabel: true,
    treatAsHold: Boolean(libraryMatch?.category === "Mobilitet" || libraryMatch?.category === "Rehab"),
  });
}

describe("member program print helpers", () => {
  it("handles numeric holdSeconds and imageUrl without throwing", () => {
    const program: TrainingProgram = {
      id: "p1",
      memberId: "m1",
      title: "Mobilitet",
      goal: "",
      notes: "",
      createdAt: "01.01.2025",
      exercises: [
        {
          id: "x1",
          exerciseId: "e1",
          exerciseName: "Strekk",
          sets: 3 as unknown as string,
          reps: "",
          weight: 30 as unknown as string,
          holdSeconds: 45 as unknown as string,
          restSeconds: 60 as unknown as string,
          notes: "",
        },
      ],
    };
    const library: Exercise = {
      id: "e1",
      name: "Strekk",
      category: "Mobilitet",
      group: "Hofte",
      equipment: "Matte",
      level: "Nybegynner",
      description: "Rolig",
      imageUrl: 123 as unknown as string,
    };

    const exercise = program.exercises[0];
    const prescription = buildMemberPrintPrescription(exercise, library);
    expect(prescription).toContain("45 sek");
    expect(prescription).toContain("60s pause");
    expect(prescription).not.toContain("30 kg");
    expect(printField(library.imageUrl)).toBe("123");
  });

  it("ignores weight column for Mobilitet when holdSeconds is empty", () => {
    const prescription = buildMemberPrintPrescription(
      {
        id: "e1",
        exerciseId: "e1",
        exerciseName: "Rotasjon",
        sets: "2",
        reps: "1",
        weight: "30",
        holdSeconds: "",
        restSeconds: "20",
        notes: "",
      },
      {
        id: "e1",
        name: "Rotasjon",
        category: "Mobilitet",
        group: "Rygg",
        equipment: "Matte",
        level: "Nybegynner",
        description: "",
      },
    );
    expect(prescription).toContain("- sek");
    expect(prescription).toContain("20s pause");
    expect(prescription).not.toContain("30 kg");
  });
});
