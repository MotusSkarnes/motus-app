import { describe, expect, it } from "vitest";
import { isHoldBasedExerciseCategory } from "./exerciseCategories";
import type { Exercise, ProgramExercise, TrainingProgram } from "./types";

function printField(value: unknown): string {
  return String(value ?? "").trim();
}

function buildMemberPrintPrescription(
  safeExercise: Partial<ProgramExercise>,
  libraryMatch: Exercise | null,
): string {
  const setCount = printField(safeExercise.sets) || "-";
  const reps = printField(safeExercise.reps) || "-";
  const weight = printField(safeExercise.weight) || "-";
  const durationMinutes = printField(safeExercise.durationMinutes);
  const speed = printField(safeExercise.speed);
  const incline = printField(safeExercise.incline);
  const restSeconds = printField(safeExercise.restSeconds) || "0";

  if (durationMinutes) {
    return `${setCount} runder × ${durationMinutes} min${speed ? ` · ${speed} km/t` : ""}${incline ? ` · ${incline}% incline` : ""} · ${restSeconds}s pause`;
  }
  if (libraryMatch && isHoldBasedExerciseCategory(libraryMatch.category)) {
    return `${setCount} sett × ${printField(safeExercise.holdSeconds) || weight || "-"} sek · ${restSeconds}s pause`;
  }
  return `${setCount} x ${reps} · ${weight} kg · ${restSeconds}s pause`;
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
    expect(printField(library.imageUrl)).toBe("123");
  });
});
