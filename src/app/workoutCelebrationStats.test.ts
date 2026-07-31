import { describe, expect, it } from "vitest";
import type { WorkoutLog } from "./types";
import { computeWorkoutRecordSetIndices } from "./workoutCelebrationStats";

function log(input: Partial<WorkoutLog>): WorkoutLog {
  return {
    id: input.id ?? "log",
    memberId: "m1",
    programTitle: "Styrke",
    date: input.date ?? "2026-06-01",
    status: "Fullført",
    note: "",
    results: input.results ?? [],
  };
}

describe("workoutCelebrationStats", () => {
  it("marks only sets that create a new running personal record", () => {
    const previous = log({
      id: "previous",
      date: "2026-06-01",
      results: [
        {
          exerciseId: "bench",
          exerciseName: "Benkpress",
          plannedSets: "1",
          plannedReps: "5",
          plannedWeight: "50",
          performedWeight: "50",
          performedReps: "5",
          completed: true,
          restSeconds: "",
          notes: "",
        },
      ],
    });
    const current = log({
      id: "current",
      date: "2026-06-08",
      results: [
        {
          exerciseId: "bench",
          exerciseName: "Benkpress",
          plannedSets: "1",
          plannedReps: "5",
          plannedWeight: "50",
          performedWeight: "51",
          performedReps: "5",
          completed: true,
          restSeconds: "",
          notes: "",
        },
        {
          exerciseId: "bench",
          exerciseName: "Benkpress",
          plannedSets: "1",
          plannedReps: "5",
          plannedWeight: "50",
          performedWeight: "50",
          performedReps: "5",
          completed: true,
          restSeconds: "",
          notes: "",
        },
        {
          exerciseId: "bench",
          exerciseName: "Benkpress",
          plannedSets: "1",
          plannedReps: "5",
          plannedWeight: "50",
          performedWeight: "52",
          performedReps: "5",
          completed: true,
          restSeconds: "",
          notes: "",
        },
      ],
    });

    expect(Array.from(computeWorkoutRecordSetIndices(current, [previous, current]))).toEqual([0, 2]);
  });

  it("does not mark a set as a new record when the same score was lifted earlier", () => {
    const previous = log({
      id: "previous-same",
      date: "2026-06-01",
      results: [
        {
          exerciseId: "deadlift",
          exerciseName: "Markløft",
          plannedSets: "1",
          plannedReps: "5",
          plannedWeight: "100",
          performedWeight: "100",
          performedReps: "5",
          completed: true,
          restSeconds: "",
          notes: "",
        },
      ],
    });
    const current = log({
      id: "current-same",
      date: "2026-06-08",
      results: [
        {
          exerciseId: "deadlift",
          exerciseName: "Markløft",
          plannedSets: "1",
          plannedReps: "5",
          plannedWeight: "100",
          performedWeight: "100",
          performedReps: "5",
          completed: true,
          restSeconds: "",
          notes: "",
        },
      ],
    });

    expect(Array.from(computeWorkoutRecordSetIndices(current, [previous, current]))).toEqual([]);
  });

  it("ignores legacy result rows without an exercise name", () => {
    const current = log({
      id: "current-legacy",
      date: "2026-06-08",
      results: [
        {
          exerciseId: "legacy",
          exerciseName: undefined,
          plannedSets: "1",
          plannedReps: "5",
          plannedWeight: "50",
          performedWeight: "50",
          performedReps: "5",
          completed: true,
          restSeconds: "",
          notes: "",
        } as unknown as NonNullable<WorkoutLog["results"]>[number],
      ],
    });

    expect(Array.from(computeWorkoutRecordSetIndices(current, [current]))).toEqual([]);
  });
});
