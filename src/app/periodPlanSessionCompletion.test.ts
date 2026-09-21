import { describe, expect, it } from "vitest";
import { resolvePeriodPlanDayCompletion, workoutLogSessionCompletion } from "./periodPlanSessionCompletion";
import type { TrainingProgram, WorkoutLog } from "./types";

function result(exerciseId: string, completed: boolean): NonNullable<WorkoutLog["results"]>[number] {
  return {
    exerciseId,
    programExerciseId: `pe-${exerciseId}`,
    exerciseName: exerciseId,
    plannedSets: "3",
    plannedReps: "10",
    plannedWeight: "20",
    performedWeight: completed ? "20" : "",
    performedReps: completed ? "10" : "",
    completed,
  };
}

function log(overrides: Partial<WorkoutLog> = {}): WorkoutLog {
  return {
    id: "log-1",
    memberId: "m1",
    programTitle: "Styrke A",
    date: "21.09.2026",
    status: "Fullført",
    note: "",
    results: [result("ex-1", true), result("ex-2", true)],
    ...overrides,
  };
}

function program(): TrainingProgram {
  return {
    id: "p1",
    memberId: "m1",
    title: "Styrke A",
    goal: "",
    notes: "",
    createdAt: "2026-01-01",
    exercises: [
      {
        id: "pe-ex-1",
        exerciseId: "ex-1",
        exerciseName: "ex-1",
        sets: "3",
        reps: "10",
        weight: "20",
        restSeconds: "60",
        notes: "",
      },
      {
        id: "pe-ex-2",
        exerciseId: "ex-2",
        exerciseName: "ex-2",
        sets: "3",
        reps: "10",
        weight: "20",
        restSeconds: "60",
        notes: "",
      },
    ],
  };
}

describe("workoutLogSessionCompletion", () => {
  it("marks a fully logged session as complete", () => {
    expect(workoutLogSessionCompletion(log(), program())).toBe("complete");
  });

  it("marks a saved session with unfinished exercises as partial", () => {
    expect(
      workoutLogSessionCompletion(
        log({ results: [result("ex-1", true), result("ex-2", false)] }),
        program(),
      ),
    ).toBe("partial");
  });
});

describe("resolvePeriodPlanDayCompletion", () => {
  it("returns complete when the matching log has all exercises done", () => {
    expect(
      resolvePeriodPlanDayCompletion({
        entry: "Styrke A",
        plannedDate: "21.09.2026",
        logs: [log()],
        programs: [program()],
        markedComplete: false,
      }),
    ).toBe("complete");
  });

  it("returns partial when the customer saved the session without logging every exercise", () => {
    expect(
      resolvePeriodPlanDayCompletion({
        entry: "Styrke A",
        plannedDate: "21.09.2026",
        logs: [log({ results: [result("ex-1", true), result("ex-2", false)] })],
        programs: [program()],
        markedComplete: true,
      }),
    ).toBe("partial");
  });
});
