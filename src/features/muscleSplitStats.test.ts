import { describe, expect, it } from "vitest";
import type { WorkoutLog } from "../app/types";
import {
  buildExerciseGroupByName,
  computeMuscleGroupStats,
  splitMuscleGroupLabel,
} from "./muscleSplitStats";

describe("splitMuscleGroupLabel", () => {
  it("splits compound groups on slash", () => {
    expect(splitMuscleGroupLabel("Bryst/Triceps")).toEqual(["Bryst", "Triceps"]);
  });

  it("keeps single groups intact", () => {
    expect(splitMuscleGroupLabel("Rygg")).toEqual(["Rygg"]);
  });
});

describe("computeMuscleGroupStats", () => {
  const exercises = [
    { id: "e1", name: "Benkpress", category: "Styrke" as const, group: "Bryst", equipment: "", level: "Nybegynner" as const, description: "" },
    { id: "e2", name: "Dips", category: "Styrke" as const, group: "Bryst/Triceps", equipment: "", level: "Nybegynner" as const, description: "" },
  ];
  const byName = buildExerciseGroupByName(exercises);

  const logs: WorkoutLog[] = [
    {
      id: "l1",
      memberId: "m1",
      programTitle: "Test",
      date: "15.05.2026",
      status: "Fullført",
      note: "",
      results: [
        {
          exerciseId: "s1",
          exerciseName: "Benkpress",
          exerciseCategory: "Styrke",
          plannedSets: "2",
          plannedReps: "5",
          plannedWeight: "80",
          performedWeight: "80",
          performedReps: "5",
          completed: true,
        },
        {
          exerciseId: "s2",
          exerciseName: "Dips",
          exerciseCategory: "Styrke",
          plannedSets: "2",
          plannedReps: "8",
          plannedWeight: "0",
          performedWeight: "0",
          performedReps: "8",
          completed: true,
        },
      ],
    },
  ];

  it("aggregates sets and splits volume for compound groups", () => {
    const stats = computeMuscleGroupStats(logs, byName, { periodDays: "all", nowTimestamp: Date.UTC(2026, 4, 15) });
    const bryst = stats.find((row) => row.group === "Bryst");
    const triceps = stats.find((row) => row.group === "Triceps");

    expect(bryst?.sets).toBe(1.5);
    expect(bryst?.volumeKg).toBe(400 + 0);
    expect(triceps?.sets).toBe(0.5);
  });
});
