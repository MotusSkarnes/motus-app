import { describe, expect, it } from "vitest";
import { buildIntervalSessionResults } from "./IntervalWorkoutSessionModal";
import type { TrainingProgram } from "../app/types";
import type { IntervalTimerStep } from "../app/intervalWorkoutSteps";

describe("buildIntervalSessionResults", () => {
  it("keeps separately recorded speed, incline and pulse for every drag", () => {
    const program: TrainingProgram = {
      id: "p", memberId: "m", title: "4 x 4 interval", goal: "", notes: "", createdAt: "",
      exercises: [{ id: "drag", exerciseId: "run", exerciseName: "Drag", sets: "2", reps: "", weight: "",
        durationMinutes: "4", speed: "10", incline: "2", targetHrPercent: "85", restSeconds: "180", notes: "" }],
    };
    const steps: IntervalTimerStep[] = [1, 2].map((number) => ({
      headline: `Drag ${number}`, phaseBadge: "Drag", durationSeconds: 240,
      speedHint: "10 km/t", inclineHint: "2 %", hrHint: "85 % av makspuls", tone: "work", sourceExerciseIndex: 0,
    }));
    const results = buildIntervalSessionResults(program, [], steps, {
      0: { speed: "11", incline: "3", heartRate: "161" },
      1: { speed: "12", incline: "4", heartRate: "169" },
    });
    expect(results).toHaveLength(2);
    expect(results.map((row) => [row.setNumber, row.exerciseName, row.performedSpeed, row.performedIncline, row.performedHeartRate]))
      .toEqual([[1, "Drag 1", "11", "3", "161"], [2, "Drag 2", "12", "4", "169"]]);
    expect(results[0].plannedSpeed).toBe("10");
    const withoutEntries = buildIntervalSessionResults(program, [], steps, {});
    expect(withoutEntries[0].performedSpeed).toBe("");
    expect(withoutEntries[0].performedIncline).toBe("");
    expect(withoutEntries[0].performedHeartRate).toBe("");
  });
});
