import { describe, expect, it } from "vitest";
import { computeWorkoutCelebrationStats } from "./workoutCelebrationStats";
import type { WorkoutLog } from "./types";

describe("computeWorkoutCelebrationStats", () => {
  it("shows logged conditioning values and the previous result for the same exercise", () => {
    const previous: WorkoutLog = {
      id: "previous", memberId: "member", programTitle: "Kondisjon", date: "2026-09-20",
      status: "Fullført", note: "", results: [{
        exerciseId: "run", programExerciseId: "row", setNumber: 1, exerciseName: "Løping",
        exerciseCategory: "Kondisjon", plannedSets: "1", plannedReps: "", plannedWeight: "",
        performedWeight: "", performedReps: "", performedDistanceKm: "4", performedHeartRate: "150", completed: true,
      }],
    };
    const current: WorkoutLog = {
      ...previous, id: "current", date: "2026-09-22", results: [{
        ...previous.results![0], performedDistanceKm: "5", performedHeartRate: "145",
      }],
    };
    const stats = computeWorkoutCelebrationStats(current, [previous]);
    expect(stats.isConditioning).toBe(true);
    expect(stats.conditioningResults[0].values).toContainEqual({ label: "Distanse", value: "5 km", previous: "4 km" });
    expect(stats.conditioningResults[0].values).toContainEqual({ label: "Puls", value: "145 slag/min", previous: "150 slag/min" });
  });
});
