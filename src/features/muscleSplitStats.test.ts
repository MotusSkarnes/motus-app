import { describe, expect, it } from "vitest";
import type { WorkoutLog } from "../app/types";
import {
  buildExerciseGroupByName,
  computeMuscleGroupStats,
  normalizeMuscleSplitGroup,
  splitMuscleGroupLabel,
} from "./muscleSplitStats";

describe("splitMuscleGroupLabel", () => {
  it("splits compound groups on slash", () => {
    expect(splitMuscleGroupLabel("Bryst/Triceps")).toEqual(["Bryst", "Triceps"]);
  });

  it("keeps single groups intact", () => {
    expect(splitMuscleGroupLabel("Rygg")).toEqual(["Rygg"]);
  });

  it("returns empty for unknown or blank labels", () => {
    expect(splitMuscleGroupLabel("")).toEqual([]);
    expect(splitMuscleGroupLabel("Ukjent")).toEqual([]);
  });
});

describe("normalizeMuscleSplitGroup", () => {
  it("rolls thigh subgroups into Bein", () => {
    expect(normalizeMuscleSplitGroup("Forside lår")).toBe("Bein");
    expect(normalizeMuscleSplitGroup("Bakside lår")).toBe("Bein");
    expect(normalizeMuscleSplitGroup("Innside lår")).toBe("Bein");
    expect(normalizeMuscleSplitGroup("Bein")).toBe("Bein");
    expect(normalizeMuscleSplitGroup("Rygg")).toBe("Rygg");
  });
});

describe("computeMuscleGroupStats", () => {
  const exercises = [
    { id: "e1", name: "Benkpress", category: "Styrke" as const, group: "Bryst", equipment: "", level: "Nybegynner" as const, description: "" },
    { id: "e2", name: "Dips", category: "Styrke" as const, group: "Bryst/Triceps", equipment: "", level: "Nybegynner" as const, description: "" },
    { id: "e3", name: "Knebøy", category: "Styrke" as const, group: "Bein", equipment: "", level: "Nybegynner" as const, description: "" },
    { id: "e4", name: "Leg curl", category: "Styrke" as const, group: "Bakside lår", equipment: "", level: "Nybegynner" as const, description: "" },
    { id: "e5", name: "Leg extension", category: "Styrke" as const, group: "Forside lår", equipment: "", level: "Nybegynner" as const, description: "" },
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

  it("merges Bein and thigh subgroups into one Bein row", () => {
    const legLogs: WorkoutLog[] = [
      {
        id: "l2",
        memberId: "m1",
        programTitle: "Bein",
        date: "16.05.2026",
        status: "Fullført",
        note: "",
        results: [
          {
            exerciseId: "s3",
            exerciseName: "Knebøy",
            exerciseCategory: "Styrke",
            plannedSets: "1",
            plannedReps: "5",
            plannedWeight: "60",
            performedWeight: "60",
            performedReps: "5",
            completed: true,
          },
          {
            exerciseId: "s4",
            exerciseName: "Leg curl",
            exerciseCategory: "Styrke",
            plannedSets: "1",
            plannedReps: "10",
            plannedWeight: "40",
            performedWeight: "40",
            performedReps: "10",
            completed: true,
          },
          {
            exerciseId: "s5",
            exerciseName: "Leg extension",
            exerciseCategory: "Styrke",
            plannedSets: "1",
            plannedReps: "10",
            plannedWeight: "35",
            performedWeight: "35",
            performedReps: "10",
            completed: true,
          },
        ],
      },
    ];
    const stats = computeMuscleGroupStats(legLogs, byName, { periodDays: "all", nowTimestamp: Date.UTC(2026, 4, 16) });
    expect(stats.find((row) => row.group === "Forside lår")).toBeUndefined();
    expect(stats.find((row) => row.group === "Bakside lår")).toBeUndefined();
    const bein = stats.find((row) => row.group === "Bein");
    expect(bein?.sets).toBe(3);
    expect(bein?.volumeKg).toBe(300 + 400 + 350);
  });

  it("excludes exercises not in the exercise bank", () => {
    const stats = computeMuscleGroupStats(logs, byName, { periodDays: "all", nowTimestamp: Date.UTC(2026, 4, 15) });
    expect(stats.find((row) => row.group === "Ukjent")).toBeUndefined();

    const customLogs: WorkoutLog[] = [
      {
        ...logs[0],
        results: [
          {
            exerciseId: "x1",
            exerciseName: "Egendefinert øvelse",
            exerciseCategory: "Styrke",
            plannedSets: "1",
            plannedReps: "10",
            plannedWeight: "50",
            performedWeight: "50",
            performedReps: "10",
            completed: true,
          },
        ],
      },
    ];
    const customStats = computeMuscleGroupStats(customLogs, byName, {
      periodDays: "all",
      nowTimestamp: Date.UTC(2026, 4, 15),
    });
    expect(customStats.find((row) => row.group === "Ukjent")).toBeUndefined();
    expect(customStats).toHaveLength(0);
  });
});
