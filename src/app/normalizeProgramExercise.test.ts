import { describe, expect, it } from "vitest";
import { normalizeProgramExercise, normalizeProgramExercises } from "./normalizeProgramExercise";

describe("normalizeProgramExercise", () => {
  it("fills missing string fields so trim-heavy UI does not crash", () => {
    const exercise = normalizeProgramExercise(
      {
        id: "pe1",
        exerciseId: "e1",
        exerciseName: "Diagonal hev",
        sets: "3",
        reps: "10",
        // weight/rest/notes intentionally missing
      },
      0,
    );
    expect(exercise.weight).toBe("");
    expect(exercise.restSeconds).toBe("");
    expect(exercise.notes).toBe("");
    expect(exercise.notes.trim()).toBe("");
    expect(exercise.weight.trim()).toBe("");
  });

  it("returns empty list for non-arrays", () => {
    expect(normalizeProgramExercises(null)).toEqual([]);
    expect(normalizeProgramExercises({})).toEqual([]);
  });
});
