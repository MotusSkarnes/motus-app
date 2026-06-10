import { describe, expect, it } from "vitest";
import { sanitizeProgramExerciseForLogAfter } from "./exercisePrescriptionFields";
import type { ProgramExercise } from "./types";

function row(overrides: Partial<ProgramExercise> = {}): ProgramExercise {
  return {
    id: "ex1",
    exerciseId: "e1",
    exerciseName: "Roing",
    sets: "4",
    reps: "",
    weight: "",
    holdSeconds: "30",
    durationMinutes: "20",
    restSeconds: "90",
    speed: "8",
    incline: "1",
    notes: "",
    ...overrides,
  };
}

describe("sanitizeProgramExerciseForLogAfter", () => {
  it("clears seconds and pause when they are not selected log fields", () => {
    const sanitized = sanitizeProgramExerciseForLogAfter(
      row({ logFieldKeys: ["minutes", "distance"] }),
    );
    expect(sanitized.holdSeconds).toBe("");
    expect(sanitized.restSeconds).toBe("");
    expect(sanitized.durationMinutes).toBe("20");
    expect(sanitized.sets).toBe("1");
  });
});
