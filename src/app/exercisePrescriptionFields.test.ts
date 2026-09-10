import { describe, expect, it } from "vitest";
import { sanitizeProgramExerciseForLogAfter, programExerciseUsesSecondsLoad, exerciseBankUsesSecondsLoad, buildProgramExerciseFromBank } from "./exercisePrescriptionFields";
import type { Exercise, ProgramExercise } from "./types";

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

describe("programExerciseUsesSecondsLoad", () => {
  it("uses seconds when the bank exercise has seconds instead of kg", () => {
    expect(exerciseBankUsesSecondsLoad(plank)).toBe(true);
    expect(
      programExerciseUsesSecondsLoad(
        { weightUnit: undefined, holdSeconds: "45", weight: "", durationMinutes: "" },
        plank,
      ),
    ).toBe(true);
  });

  it("uses seconds when holdSeconds is set and kg is 0", () => {
    expect(
      programExerciseUsesSecondsLoad({
        holdSeconds: "40",
        weight: "0",
        durationMinutes: "",
      }),
    ).toBe(true);
  });

  it("keeps kg for ordinary strength exercises", () => {
    expect(
      programExerciseUsesSecondsLoad(
        { holdSeconds: "", weight: "60", durationMinutes: "" },
        { category: "Styrke", prescriptionFields: ["reps", "kg", "pause"] },
      ),
    ).toBe(false);
  });

  it("builds program rows from seconds-based bank exercises with weightUnit seconds", () => {
    const built = buildProgramExerciseFromBank(plank);
    expect(built.weightUnit).toBe("seconds");
    expect(built.holdSeconds).toBe("30");
    expect(built.weight).toBe("");
  });
});
