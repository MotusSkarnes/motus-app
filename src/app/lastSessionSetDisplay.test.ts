import { describe, expect, it } from "vitest";
import {
  formatLastSessionSetLabel,
  pickLastSetFromLastSession,
  resolveDetailLastSessionLabel,
} from "./lastSessionSetDisplay";

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

describe("formatLastSessionSetLabel", () => {
  it("formats strength last set with set number", () => {
    expect(formatLastSessionSetLabel("Benkpress", { weight: "80", reps: "6" }, library, 3)).toBe(
      "Sett 3 · 6 reps · 80 kg",
    );
  });
});
