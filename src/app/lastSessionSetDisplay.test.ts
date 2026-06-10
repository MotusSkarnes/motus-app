import { describe, expect, it } from "vitest";
import {
  buildLastSessionByExerciseFromLogs,
  formatLastSessionSetLabel,
  pickLastSetFromLastSession,
  pickPreviousSetEntry,
  resolveDetailLastSessionLabel,
  resolveLastSessionEntryForRow,
} from "./lastSessionSetDisplay";
import type { WorkoutExerciseResult, WorkoutLog } from "./types";

const library = [
  {
    id: "ex-1",
    name: "Benkpress",
    category: "Styrke" as const,
    group: "Bryst",
    equipment: "Stang",
    level: "Nybegynner" as const,
    description: "",
    imageUrl: "",
  },
];

describe("pickLastSetFromLastSession", () => {
  it("picks highest set number", () => {
    const map = new Map([
      [1, { weight: "60", reps: "10" }],
      [3, { weight: "80", reps: "6" }],
      [2, { weight: "70", reps: "8" }],
    ]);
    expect(pickLastSetFromLastSession(map)).toEqual({
      setNumber: 3,
      entry: { weight: "80", reps: "6" },
    });
  });
});

describe("resolveDetailLastSessionLabel", () => {
  it("returns empty when no last session map", () => {
    expect(
      resolveDetailLastSessionLabel({
        detailExercise: library[0],
        blockDetailExercise: null,
        blockExerciseInfos: [],
        exercises: library,
      }),
    ).toBe("");
  });

  it("resolves label from workout exercise name", () => {
    const lastSessionByExercise = new Map([
      ["benkpress", new Map([[2, { weight: "70", reps: "8" }]])],
    ]);
    expect(
      resolveDetailLastSessionLabel({
        lastSessionByExercise,
        detailExercise: library[0],
        blockDetailExercise: null,
        currentWorkoutExerciseName: "Benkpress",
        blockExerciseInfos: [],
        exercises: library,
      }),
    ).toBe("Sett 2 · 8 reps · 70 kg");
  });
});

describe("pickPreviousSetEntry", () => {
  it("prefers the highest completed set below the target set number", () => {
    const map = new Map([
      [1, { weight: "60", reps: "10" }],
      [3, { weight: "80", reps: "6" }],
    ]);
    expect(pickPreviousSetEntry(map, 2)).toEqual({ weight: "60", reps: "10" });
    expect(pickPreviousSetEntry(map, 4)).toEqual({ weight: "80", reps: "6" });
  });
});

describe("resolveLastSessionEntryForRow", () => {
  const row = (input: Partial<WorkoutExerciseResult>): WorkoutExerciseResult => ({
    exerciseId: "ex-1",
    exerciseName: "Benkpress",
    plannedSets: "3",
    plannedReps: "8",
    plannedWeight: "50",
    performedWeight: "",
    performedReps: "",
    completed: false,
    ...input,
  });

  it("uses the previous completed set from the live session before program weight", () => {
    const sessionRows = [
      row({ exerciseId: "s1", setNumber: 1, performedWeight: "70", performedReps: "8", completed: true }),
      row({ exerciseId: "s2", setNumber: 2, performedWeight: "", performedReps: "", completed: false }),
    ];
    expect(resolveLastSessionEntryForRow(sessionRows[1]!, sessionRows)).toEqual({
      weight: "70",
      reps: "8",
      durationMinutes: undefined,
      speed: undefined,
      incline: undefined,
    });
  });
});

describe("buildLastSessionByExerciseFromLogs", () => {
  it("takes the most recent completed log per exercise", () => {
    const logs: WorkoutLog[] = [
      {
        id: "log-1",
        memberId: "m1",
        programTitle: "A",
        date: "2026-06-01",
        status: "Fullført",
        results: [
          {
            exerciseId: "r1",
            exerciseName: "Benkpress",
            plannedSets: "3",
            plannedReps: "8",
            plannedWeight: "50",
            performedWeight: "60",
            performedReps: "10",
            completed: true,
            setNumber: 1,
          },
        ],
      },
      {
        id: "log-2",
        memberId: "m1",
        programTitle: "B",
        date: "2026-06-02",
        status: "Fullført",
        results: [
          {
            exerciseId: "r2",
            exerciseName: "Benkpress",
            plannedSets: "3",
            plannedReps: "8",
            plannedWeight: "50",
            performedWeight: "80",
            performedReps: "6",
            completed: true,
            setNumber: 1,
          },
        ],
      },
    ];
    const map = buildLastSessionByExerciseFromLogs(logs);
    expect(map.get("benkpress")?.get(1)).toEqual({ weight: "80", reps: "6" });
  });
});

describe("formatLastSessionSetLabel", () => {
  it("formats strength last set with set number", () => {
    expect(formatLastSessionSetLabel("Benkpress", { weight: "80", reps: "6" }, library, 3)).toBe(
      "Sett 3 · 6 reps · 80 kg",
    );
  });
});
