import { describe, expect, it } from "vitest";
import { buildTrainerMemberProgressSnapshot, computeTrainerWeeklyInsight } from "./trainerMemberProgress";
import type { Exercise, WorkoutLog } from "./types";

const bench: Exercise = {
  id: "e-bench",
  name: "Benkpress",
  category: "Styrke",
  group: "Bryst",
  equipment: "Stang",
  level: "Nybegynner",
  description: "",
};

function completedLog(
  id: string,
  date: string,
  results: WorkoutLog["results"],
): WorkoutLog {
  return {
    id,
    memberId: "m1",
    programTitle: "Styrke A",
    date,
    status: "Fullført",
    note: "",
    results,
  };
}

describe("trainerMemberProgress", () => {
  it("summarizes weekly sessions and strength change for the trainer", () => {
    const now = Date.parse("2026-09-14T12:00:00.000Z");
    const snapshot = buildTrainerMemberProgressSnapshot({
      nowTimestamp: now,
      periodWeeks: 4,
      exercises: [bench],
      logs: [
        completedLog("a", "17.08.2026", [
          {
            exerciseId: "e-bench",
            exerciseName: "Benkpress",
            plannedSets: "3",
            plannedReps: "5",
            plannedWeight: "60",
            performedWeight: "60",
            performedReps: "5",
            completed: true,
          },
        ]),
        completedLog("b", "24.08.2026", [
          {
            exerciseId: "e-bench",
            exerciseName: "Benkpress",
            plannedSets: "3",
            plannedReps: "5",
            plannedWeight: "70",
            performedWeight: "70",
            performedReps: "5",
            completed: true,
          },
        ]),
        completedLog("c", "07.09.2026", [
          {
            exerciseId: "e-bench",
            exerciseName: "Benkpress",
            plannedSets: "3",
            plannedReps: "5",
            plannedWeight: "75",
            performedWeight: "75",
            performedReps: "5",
            completed: true,
          },
        ]),
      ],
    });

    expect(snapshot.periodStats.workouts).toBeGreaterThanOrEqual(2);
    expect(snapshot.weeklyBars).toHaveLength(4);
    expect(snapshot.averageSessionsPerWeek).toBeGreaterThan(0);
    expect(snapshot.strengthLifts[0]?.name).toBe("Benkpress");
    expect(snapshot.strengthLifts[0]?.deltaValue).toBeGreaterThan(0);
  });

  it("describes weekly session change without member-facing copy", () => {
    expect(computeTrainerWeeklyInsight(3, 2)).toContain("flere økter per uke");
    expect(computeTrainerWeeklyInsight(2, 3)).toContain("færre økter per uke");
    expect(computeTrainerWeeklyInsight(0, 0)).toBeNull();
  });
});
