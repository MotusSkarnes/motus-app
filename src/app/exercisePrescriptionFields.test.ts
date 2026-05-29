import { describe, expect, it } from "vitest";
import {
  buildProgramExerciseFromBank,
  defaultPrescriptionFieldsForCategory,
  normalizeExercisePrescriptionFields,
  resolveExercisePrescriptionFields,
  resolvePrescriptionFieldLabel,
  toggleExercisePrescriptionField,
} from "./exercisePrescriptionFields";
import type { Exercise } from "./types";

describe("exercisePrescriptionFields", () => {
  it("defaults by category", () => {
    expect(defaultPrescriptionFieldsForCategory("Styrke")).toEqual(["reps", "kg", "pause"]);
    expect(defaultPrescriptionFieldsForCategory("Kondisjon")).toEqual(["minutes", "seconds", "pause"]);
    expect(defaultPrescriptionFieldsForCategory("Mobilitet")).toEqual(["seconds", "pause"]);
  });

  it("respects custom fields on exercise", () => {
    const exercise: Exercise = {
      id: "1",
      name: "Leg press",
      category: "Styrke",
      group: "Bein",
      equipment: "Maskin",
      level: "Nybegynner",
      description: "",
      prescriptionFields: ["reps", "kg", "seatSettings"],
    };
    expect(resolveExercisePrescriptionFields(exercise)).toEqual(["reps", "kg", "seatSettings"]);
    const row = buildProgramExerciseFromBank(exercise);
    expect(row.seatSetting).toBe("");
    expect(row.reps).toBe("10");
    expect(row.weight).toBe("0");
  });

  it("cannot remove last field", () => {
    expect(toggleExercisePrescriptionField(["reps"], "reps")).toEqual(["reps"]);
  });

  it("normalizes unknown keys", () => {
    expect(normalizeExercisePrescriptionFields(["reps", "bogus", "kg"], "Styrke")).toEqual(["reps", "kg"]);
  });

  it("uses custom labels when set", () => {
    expect(
      resolvePrescriptionFieldLabel("custom1", { customField1Label: "Tempo", customField2Label: "" }),
    ).toBe("Tempo");
  });

  it("keeps per-exercise fields independent", () => {
    const a: Exercise = {
      id: "a",
      name: "A",
      category: "Styrke",
      group: "Bein",
      equipment: "",
      level: "Nybegynner",
      description: "",
      prescriptionFields: ["reps", "kg"],
    };
    const b: Exercise = {
      ...a,
      id: "b",
      name: "B",
      prescriptionFields: ["reps", "kg", "seatSettings"],
    };
    expect(resolveExercisePrescriptionFields(a)).toEqual(["reps", "kg"]);
    expect(resolveExercisePrescriptionFields(b)).toEqual(["reps", "kg", "seatSettings"]);
  });
});
