import { describe, expect, it } from "vitest";
import { buildExerciseStrengthHistory, estimate1RmKg } from "./personalRecordProgress";
import type { WorkoutLog } from "./types";

describe("personalRecordProgress", () => {
  it("estimates 1RM with Epley formula", () => {
    expect(estimate1RmKg(100, 5)).toBeCloseTo(116.7, 1);
  });

  it("builds history with best set per day", () => {
    const logs: WorkoutLog[] = [
      {
        id: "1",
        memberId: "m1",
        programTitle: "A",
        date: "01.05.2026",
        status: "Fullført",
        note: "",
        results: [
          {
            exerciseId: "e1",
            exerciseName: "Benkpress",
            plannedSets: "3",
            plannedReps: "5",
            plannedWeight: "60",
            performedWeight: "60",
            performedReps: "5",
            completed: true,
          },
        ],
      },
      {
        id: "2",
        memberId: "m1",
        programTitle: "B",
        date: "15.05.2026",
        status: "Fullført",
        note: "",
        results: [
          {
            exerciseId: "e1",
            exerciseName: "Benkpress",
            plannedSets: "3",
            plannedReps: "5",
            plannedWeight: "70",
            performedWeight: "70",
            performedReps: "5",
            completed: true,
          },
        ],
      },
    ];
    const history = buildExerciseStrengthHistory(logs, "Benkpress");
    expect(history).toHaveLength(2);
    expect(history[1].estimated1RmKg).toBeGreaterThan(history[0].estimated1RmKg);
  });
});
