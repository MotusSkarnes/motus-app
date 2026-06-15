import { describe, expect, it } from "vitest";
import { buildConditioningProgramNotes } from "./conditioningProgramMode";
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

  it("does not use interval timer when exercises have logFieldKeys even without notes marker", () => {
    const program = program4x4([
      {
        ...row("Løping", { durationMinutes: "30", holdSeconds: "30" }),
        logFieldKeys: ["minutes", "distance"],
      },
    ]);
    expect(isMemberIntervalWorkoutProgram(program, categories, exercises)).toBe(false);
  });

  it("does not use interval timer for explicit log-after conditioning programs", () => {
    const program = program4x4([
      row("Løping", { durationMinutes: "45" }),
    ]);
    program.notes = buildConditioningProgramNotes("logAfter", "");
    expect(isMemberIntervalWorkoutProgram(program, categories, exercises)).toBe(false);
  });

  it("uses interval timer for explicit interval conditioning programs", () => {
    const program = program4x4([row("Løping")]);
    program.notes = buildConditioningProgramNotes("interval", "");
    expect(isMemberIntervalWorkoutProgram(program, categories, exercises)).toBe(true);
  });

  it("does not treat conditioning title alone as interval without timed steps", () => {
    const program: TrainingProgram = {
      id: "p-title",
      memberId: "m1",
      title: "Kondisjon løping",
      goal: "",
      notes: "",
      createdAt: "",
      exercises: [
        {
          id: "x1",
          exerciseId: "e2",
          exerciseName: "Løping",
          sets: "1",
          reps: "",
          weight: "",
          durationMinutes: "",
          holdSeconds: "",
          restSeconds: "",
          notes: "",
        },
      ],
    };
    expect(isMemberIntervalWorkoutProgram(program, categories, exercises)).toBe(false);
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

  it("does not treat timed strength/core programs as interval", () => {
    const program: TrainingProgram = {
      id: "p-upper-core",
      memberId: "m1",
      title: "Overkropp og kjerne",
      goal: "",
      notes: "",
      createdAt: "",
      exercises: [
        {
          id: "x1",
          exerciseId: "e1",
          exerciseName: "Nedtrekk bredt grep",
          sets: "3",
          reps: "8",
          weight: "35",
          durationMinutes: "",
          holdSeconds: "",
          restSeconds: "90",
          notes: "",
        },
        {
          id: "x2",
          exerciseId: "e1",
          exerciseName: "Pallof press",
          sets: "3",
          reps: "30",
          weight: "0",
          durationMinutes: "1",
          holdSeconds: "30",
          restSeconds: "90",
          notes: "Kjernehold",
        },
      ],
    };
    expect(isMemberIntervalWorkoutProgram(program, categories, exercises)).toBe(false);
  });
});
