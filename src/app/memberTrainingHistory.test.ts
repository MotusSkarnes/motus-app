import { describe, expect, it } from "vitest";
import type { WorkoutLog } from "./types";
import {
  computeConsistencyHeatmap,
  computeHistoryPeriodStats,
  computeWeeklyAverageInsight,
  computeWeeklyWorkoutBars,
  formatTrainingDuration,
  topLoggedExercises,
} from "./memberTrainingHistory";

function log(partial: Partial<WorkoutLog> & Pick<WorkoutLog, "id" | "date">): WorkoutLog {
  return {
    memberId: "m1",
    programTitle: "Program",
    status: "Fullført",
    note: "",
    ...partial,
  };
}

describe("memberTrainingHistory", () => {
  const now = new Date("2026-05-24T12:00:00").getTime();

  it("aggregates period stats and deltas", () => {
    const logs: WorkoutLog[] = [
      log({
        id: "1",
        date: "2026-05-20",
        results: [{ exerciseName: "Benkpress", completed: true, performedWeight: "60", performedReps: "5" }],
      }),
      log({
        id: "2",
        date: "2025-12-01",
        results: [{ exerciseName: "Benkpress", completed: true, performedWeight: "50", performedReps: "5" }],
      }),
    ];

    const stats = computeHistoryPeriodStats(logs, 12, now);
    expect(stats.workouts).toBe(1);
    expect(stats.workoutsDelta).toBe(1);
    expect(stats.personalRecords).toBeGreaterThan(0);
  });

  it("builds weekly bars and insight text", () => {
    const logs: WorkoutLog[] = [
      log({ id: "1", date: "2026-05-19" }),
      log({ id: "2", date: "2026-05-21" }),
    ];
    const bars = computeWeeklyWorkoutBars(logs, 4, now);
    expect(bars).toHaveLength(4);
    const insight = computeWeeklyAverageInsight(bars, bars.map((bar) => ({ ...bar, count: 0 })));
    expect(insight).toMatch(/over snittet|kommet i gang/i);
  });

  it("formats training duration", () => {
    expect(formatTrainingDuration(90)).toBe("1 t 30 m");
    expect(formatTrainingDuration(45)).toBe("45 min");
  });

  it("ranks top logged exercises", () => {
    const logs: WorkoutLog[] = [
      log({
        id: "1",
        date: "2026-05-20",
        results: [
          { exerciseName: "Benkpress", completed: true, performedWeight: "60", performedReps: "5" },
          { exerciseName: "Benkpress", completed: true, performedWeight: "60", performedReps: "5" },
          { exerciseName: "Squat", completed: true, performedWeight: "80", performedReps: "5" },
        ],
      }),
    ];
    const top = topLoggedExercises(logs);
    expect(top[0]?.name).toBe("Benkpress");
    expect(top[0]?.sets).toBe(2);
  });

  it("builds a three-month heatmap", () => {
    const logs: WorkoutLog[] = [log({ id: "1", date: "2026-05-10" })];
    const months = computeConsistencyHeatmap(logs, 3, now);
    expect(months).toHaveLength(3);
    expect(months.some((month) => month.cells.some((cell) => cell && cell.count > 0))).toBe(true);
  });
});
