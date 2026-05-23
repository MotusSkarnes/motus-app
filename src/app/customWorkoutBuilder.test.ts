import { describe, expect, it } from "vitest";
import {
  buildCustomWorkoutInsights,
  buildCustomWorkoutPreview,
  isPullExercise,
  recommendExercisesForCustomWorkout,
  reorderCustomWorkoutLines,
} from "./customWorkoutBuilder";
import type { Exercise, WorkoutLog } from "./types";

const pull: Exercise = {
  id: "pull",
  name: "Roing",
  category: "Styrke",
  group: "Rygg",
  equipment: "Kabel",
  level: "Middels",
  description: "",
};

const push: Exercise = {
  id: "push",
  name: "Benkpress",
  category: "Styrke",
  group: "Bryst",
  equipment: "Stang",
  level: "Middels",
  description: "",
};

const legs: Exercise = {
  id: "legs",
  name: "Knebøy",
  category: "Styrke",
  group: "Bein",
  equipment: "Stang",
  level: "Middels",
  description: "",
};

describe("customWorkoutBuilder", () => {
  it("detects missing pull exercise in draft", () => {
    const insights = buildCustomWorkoutInsights({
      draftExercises: [push, legs],
      completedLogs: [],
      allExercises: [pull, push, legs],
      nowDate: new Date("2026-05-22"),
    });
    expect(insights.some((insight) => insight.id === "missing-pull")).toBe(true);
  });

  it("builds live preview totals", () => {
    const preview = buildCustomWorkoutPreview(
      [
        { key: "a", exerciseId: "pull", sets: "3", reps: "10", weight: "40" },
        { key: "b", exerciseId: "legs", sets: "4", reps: "8", weight: "60" },
      ],
      [pull, legs],
    );
    expect(preview.exerciseCount).toBe(2);
    expect(preview.totalSets).toBe(7);
    expect(preview.muscleGroups).toEqual(["Bein", "Rygg"]);
  });

  it("reorders workout lines", () => {
    const lines = [
      { key: "a", exerciseId: "pull", sets: "3", reps: "10", weight: "" },
      { key: "b", exerciseId: "push", sets: "3", reps: "10", weight: "" },
    ];
    expect(reorderCustomWorkoutLines(lines, "b", "a").map((line) => line.key)).toEqual(["b", "a"]);
  });

  it("recommends pull exercises when draft lacks pull", () => {
    const recommended = recommendExercisesForCustomWorkout({
      allExercises: [pull, push, legs],
      draftExerciseIds: new Set(["push"]),
      completedLogs: [] as WorkoutLog[],
      insights: [{ id: "missing-pull", message: "Du mangler en trekkøvelse", tone: "suggest", targetMuscleGroup: "Rygg" }],
    });
    expect(recommended[0]?.id).toBe("pull");
    expect(isPullExercise(pull)).toBe(true);
  });
});
