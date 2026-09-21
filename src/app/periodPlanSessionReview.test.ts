import { describe, expect, it } from "vitest";
import { buildPeriodPlanSessionReview } from "./periodPlanSessionReview";
import type { TrainingProgram, WorkoutLog } from "./types";

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
        id: "pe-1",
        exerciseId: "ex-1",
        exerciseName: "Knebøy",
        sets: "3",
        reps: "8",
        weight: "40",
        restSeconds: "90",
        notes: "",
      },
    ],
  };
}

function log(overrides: Partial<WorkoutLog> = {}): WorkoutLog {
  return {
    id: "log-1",
    memberId: "m1",
    programTitle: "Styrke A",
    date: "21.09.2026",
    status: "Fullført",
    note: "Tungt i dag",
    results: [
      {
        exerciseId: "pe-1-set-1",
        programExerciseId: "pe-1",
        setNumber: 1,
        exerciseName: "Knebøy",
        plannedSets: "3",
        plannedReps: "8",
        plannedWeight: "40",
        performedWeight: "42.5",
        performedReps: "8",
        completed: true,
      },
    ],
    ...overrides,
  };
}

describe("buildPeriodPlanSessionReview", () => {
  it("pairs planned exercises with the sets the customer logged", () => {
    const review = buildPeriodPlanSessionReview({ program: program(), log: log() });
    expect(review).toHaveLength(1);
    expect(review[0]?.name).toBe("Knebøy");
    expect(review[0]?.plannedLabel).toContain("8");
    expect(review[0]?.plannedLabel).toContain("40");
    expect(review[0]?.sets).toEqual([
      expect.objectContaining({
        setNumber: 1,
        completed: true,
        performedLabel: expect.stringContaining("42.5"),
      }),
    ]);
  });

  it("keeps planned exercises even when the customer has not logged yet", () => {
    const review = buildPeriodPlanSessionReview({ program: program(), log: null });
    expect(review[0]?.name).toBe("Knebøy");
    expect(review[0]?.sets).toEqual([]);
  });
});
