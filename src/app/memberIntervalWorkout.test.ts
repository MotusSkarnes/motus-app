import { describe, expect, it } from "vitest";
import { buildExerciseCategoryById } from "./trainingProgramKind";
import { isMemberIntervalWorkoutProgram } from "./memberIntervalWorkout";
import type { Exercise, TrainingProgram } from "./types";

const exercises: Exercise[] = [
  { id: "e2", name: "Mølle", category: "Kondisjon", group: "Bein", equipment: "Tredemølle", level: "Nybegynner", description: "" },
];

const categories = buildExerciseCategoryById(exercises);

function row(
  exerciseName: string,
  options?: { durationMinutes?: string; holdSeconds?: string; sets?: string },
): TrainingProgram["exercises"][number] {
  return {
    id: `x-${exerciseName}`,
    exerciseId: "e2",
    exerciseName,
    sets: options?.sets ?? "4",
    reps: "",
    weight: "",
    durationMinutes: options?.durationMinutes ?? "",
    holdSeconds: options?.holdSeconds ?? "",
    restSeconds: "",
    notes: "",
  };
}

function program4x4(rows: TrainingProgram["exercises"]): TrainingProgram {
  return {
    id: "p-4x4",
    memberId: "m1",
    title: "4x4 intervall",
    goal: "",
    notes: "",
    createdAt: "",
    exercises: rows,
  };
}

describe("isMemberIntervalWorkoutProgram", () => {
  it("detects classic 4x4 intervall by title", () => {
    const program = program4x4([
      row("Oppvarming", { durationMinutes: "10" }),
      row("Drag 1", { durationMinutes: "4" }),
      row("Nedjogg", { durationMinutes: "5" }),
    ]);
    expect(isMemberIntervalWorkoutProgram(program, categories, exercises)).toBe(true);
  });

  it("detects 4x4 with holdSeconds drag rows (no intervall in exercise category path)", () => {
    const program = program4x4([
      row("Oppvarming", { holdSeconds: "600" }),
      row("Drag 1", { holdSeconds: "240", sets: "4" }),
      row("Nedjogg", { holdSeconds: "300" }),
    ]);
    expect(isMemberIntervalWorkoutProgram(program, categories, exercises)).toBe(true);
  });

  it("does not treat pure strength programs as interval", () => {
    const program: TrainingProgram = {
      id: "p-strength",
      memberId: "m1",
      title: "Benk og bøy",
      goal: "",
      notes: "",
      createdAt: "",
      exercises: [
        {
          id: "x1",
          exerciseId: "e1",
          exerciseName: "Benk",
          sets: "3",
          reps: "8",
          weight: "60",
          durationMinutes: "",
          holdSeconds: "",
          restSeconds: "90",
          notes: "",
        },
      ],
    };
    expect(isMemberIntervalWorkoutProgram(program, categories, exercises)).toBe(false);
  });
});
