import { describe, expect, it } from "vitest";
import {
  formatWorkoutGroupPlanLabel,
  formatWorkoutResultPerformedLabel,
  formatWorkoutResultSetPlanLabel,
} from "./programExercisePresentation";
import type { ProgramExercise, TrainingProgram, WorkoutExerciseResult } from "./types";

const library = [{ id: "ex-1", name: "Benkpress", category: "Styrke" as const, group: "Bryst", equipment: "Stang", level: "Nybegynner" as const, description: "", imageUrl: "" }];

function programExercise(overrides: Partial<ProgramExercise> = {}): ProgramExercise {
  return {
    id: "pe-1",
    exerciseId: "ex-1",
    exerciseName: "Benkpress",
    sets: "3",
    reps: "10",
    repsUnit: "reps",
    weight: "60",
    weightUnit: "kg",
    restSeconds: "90",
    notes: "",
    ...overrides,
  };
}

function workoutRow(overrides: Partial<WorkoutExerciseResult> = {}): WorkoutExerciseResult {
  return {
    exerciseId: "r1",
    programExerciseId: "pe-1",
    setNumber: 1,
    exerciseName: "Benkpress",
    plannedSets: "3",
    plannedReps: "10",
    plannedRepsUnit: "reps",
    plannedWeight: "60",
    plannedWeightUnit: "kg",
    performedWeight: "62",
    performedReps: "10",
    completed: true,
    ...overrides,
  };
}

describe("formatWorkoutGroupPlanLabel", () => {
  it("matches program prescription for strength exercise", () => {
    const exercise = programExercise();
    const program: TrainingProgram = {
      id: "p1",
      memberId: "m1",
      title: "Test",
      goal: "",
      notes: "",
      createdAt: "",
      exercises: [exercise],
    };
    const label = formatWorkoutGroupPlanLabel(
      {
        groupId: exercise.id,
        exerciseName: exercise.exerciseName,
        exerciseNames: [exercise.exerciseName],
        plannedReps: exercise.reps,
        plannedWeight: exercise.weight,
        rows: [workoutRow()],
        segments: [],
        rounds: [],
      },
      program,
      library,
    );
    expect(label).toBe("3×10 reps · 60 kg · 90s");
  });

  it("keeps program set count in øktmodus when extra rows exist (useLiveSetCount false)", () => {
    const exercise = programExercise({ sets: "3" });
    const program: TrainingProgram = {
      id: "p1",
      memberId: "m1",
      title: "Test",
      goal: "",
      notes: "",
      createdAt: "",
      exercises: [exercise],
    };
    const rows = [
      workoutRow({ setNumber: 1 }),
      workoutRow({ setNumber: 2, exerciseId: "pex-set-2" }),
      workoutRow({ setNumber: 3, exerciseId: "pex-set-3" }),
      workoutRow({ setNumber: 4, exerciseId: "pex-set-4", addedDuringWorkout: true }),
    ];
    const label = formatWorkoutGroupPlanLabel(
      {
        groupId: exercise.id,
        exerciseName: exercise.exerciseName,
        exerciseNames: [exercise.exerciseName],
        plannedReps: exercise.reps,
        plannedWeight: exercise.weight,
        rows,
        segments: [],
        rounds: [],
      },
      program,
      library,
      { useLiveSetCount: false },
    );
    expect(label).toBe("3×10 reps · 60 kg · 90s");
    const liveLabel = formatWorkoutGroupPlanLabel(
      {
        groupId: exercise.id,
        exerciseName: exercise.exerciseName,
        exerciseNames: [exercise.exerciseName],
        plannedReps: exercise.reps,
        plannedWeight: exercise.weight,
        rows,
        segments: [],
        rounds: [],
      },
      program,
      library,
      { useLiveSetCount: true },
    );
    expect(liveLabel).toBe("4×10 reps · 60 kg · 90s");
  });

  it("uses planned weight from workout rows when it differs from program", () => {
    const exercise = programExercise({ weight: "60" });
    const program: TrainingProgram = {
      id: "p1",
      memberId: "m1",
      title: "Test",
      goal: "",
      notes: "",
      createdAt: "",
      exercises: [exercise],
    };
    const label = formatWorkoutGroupPlanLabel(
      {
        groupId: exercise.id,
        exerciseName: exercise.exerciseName,
        exerciseNames: [exercise.exerciseName],
        plannedReps: exercise.reps,
        plannedWeight: "62",
        rows: [workoutRow({ plannedWeight: "62" })],
        segments: [],
        rounds: [],
      },
      program,
      library,
    );
    expect(label).toBe("3×10 reps · 62 kg · 90s");
  });
});

describe("workout log labels", () => {
  it("formats set plan and performed strength consistently", () => {
    const row = workoutRow();
    expect(formatWorkoutResultSetPlanLabel(row, library)).toBe("10 reps · 60 kg");
    expect(formatWorkoutResultPerformedLabel(row, library)).toBe("10 reps · 62 kg");
  });

  it("formats cardio performed with speed and incline", () => {
    const row = workoutRow({
      exerciseName: "Intervall",
      exerciseCategory: "Kondisjon",
      plannedDurationMinutes: "4",
      plannedSpeed: "12",
      plannedIncline: "2",
      performedDurationMinutes: "4",
      performedSpeed: "11.5",
      performedIncline: "1",
      plannedReps: "",
      plannedWeight: "",
      performedReps: "",
      performedWeight: "",
    });
    expect(formatWorkoutResultSetPlanLabel(row, library)).toBe("4 min · 12 km/t · 2% incline");
    expect(formatWorkoutResultPerformedLabel(row, library)).toBe("4 min · 11.5 km/t · 1% incline");
  });
});
