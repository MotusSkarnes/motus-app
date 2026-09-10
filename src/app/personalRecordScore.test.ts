import { describe, expect, it } from "vitest";
import {
  bestPersonalRecordScoreForExercise,
  formatPersonalRecordScore,
  formatPersonalRecordSetSummary,
  personalRecordScore,
  resolvePersonalRecordKind,
} from "./personalRecordScore";
import type { Exercise, WorkoutLog } from "./types";

const plank: Exercise = {
  id: "e29",
  name: "Planke",
  category: "Styrke",
  group: "Kjerne",
  equipment: "Kroppsvekt",
  level: "Nybegynner",
  description: "",
  prescriptionFields: ["seconds", "pause"],
};

describe("personalRecordScore", () => {
  it("does not treat a 30 sek plank with leftover reps as 40 kg 1RM", () => {
    const row = {
      performedLoadUnit: "sec" as const,
      plannedWeightUnit: "seconds" as const,
      exerciseCategory: "Styrke" as const,
      performedWeight: "30",
      performedReps: "10",
    };
    expect(resolvePersonalRecordKind(row, plank)).toBe("seconds");
    expect(personalRecordScore(row, "seconds")).toBe(30);
    expect(formatPersonalRecordSetSummary("seconds", 30, 10)).toBe("30 sek");
    expect(formatPersonalRecordScore("seconds", 30)).toBe("30 sek");
  });

  it("treats leftover kg x reps on a seconds exercise as seconds, not 1RM", () => {
    const row = {
      performedLoadUnit: "kg" as const,
      plannedWeightUnit: "kg" as const,
      exerciseCategory: "Styrke" as const,
      performedWeight: "30",
      performedReps: "10",
    };
    expect(resolvePersonalRecordKind(row, plank)).toBe("seconds");
    expect(personalRecordScore(row, "seconds")).toBe(30);
  });

  it("uses reps for reps-only rehab exercises", () => {
    const diagonal: Exercise = {
      id: "ex-diag",
      name: "Diagonal hev",
      category: "Rehab",
      group: "Skulder",
      equipment: "Strikk",
      level: "Nybegynner",
      description: "",
      prescriptionFields: ["reps"],
    };
    const row = {
      performedLoadUnit: "kg" as const,
      plannedWeightUnit: "kg" as const,
      exerciseCategory: "Rehab" as const,
      performedWeight: "",
      performedReps: "12",
    };
    expect(resolvePersonalRecordKind(row, diagonal)).toBe("reps");
    expect(personalRecordScore(row, "reps")).toBe(12);
  });

  it("keeps 1RM for kg x reps lifts", () => {
    const row = {
      performedLoadUnit: "kg" as const,
      plannedWeightUnit: "kg" as const,
      exerciseCategory: "Styrke" as const,
      performedWeight: "80",
      performedReps: "5",
    };
    expect(resolvePersonalRecordKind(row)).toBe("oneRm");
    expect(personalRecordScore(row, "oneRm")).toBeCloseTo(93.3, 1);
  });

  it("compares plank history as seconds, not leftover 1RM", () => {
    const logs: WorkoutLog[] = [
      {
        id: "old",
        memberId: "m1",
        programTitle: "A",
        date: "01.05.2026",
        status: "Fullført",
        note: "",
        results: [
          {
            exerciseId: "p1",
            exerciseName: "Planke",
            plannedSets: "3",
            plannedReps: "10",
            plannedWeight: "30",
            performedWeight: "30",
            performedReps: "10",
            performedLoadUnit: "kg",
            completed: true,
          },
        ],
      },
    ];
    expect(bestPersonalRecordScoreForExercise(logs, "Planke", "seconds", "m1")).toBe(30);
    expect(bestPersonalRecordScoreForExercise(logs, "Planke", "oneRm", "m1")).toBeGreaterThan(30);
  });
});
