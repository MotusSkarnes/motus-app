import { describe, expect, it } from "vitest";
import {
  normalizeProgramExerciseForCategory,
  programDraftUsesHoldFields,
  programExerciseHoldSeconds,
} from "./exerciseCategories";

describe("exerciseCategories mobility prescription", () => {
  it("does not use weight field as hold seconds for Mobilitet", () => {
    expect(
      programExerciseHoldSeconds({ holdSeconds: "", weight: "40" }, "Mobilitet"),
    ).toBe("");
    expect(
      programExerciseHoldSeconds({ holdSeconds: "45", weight: "40" }, "Mobilitet"),
    ).toBe("45");
  });

  it("allows legacy weight fallback for Uttøyning", () => {
    expect(programExerciseHoldSeconds({ holdSeconds: "", weight: "40" }, "Uttøyning")).toBe("40");
  });

  it("uses hold fields in mobility program builder tab", () => {
    expect(programDraftUsesHoldFields(undefined, "mobility")).toBe(true);
    expect(programDraftUsesHoldFields("Styrke", "mobility")).toBe(true);
    expect(programDraftUsesHoldFields("Mobilitet", "strength")).toBe(true);
  });

  it("clears weight when normalizing Mobilitet program rows", () => {
    expect(
      normalizeProgramExerciseForCategory(
        {
          id: "x",
          exerciseId: "e1",
          exerciseName: "Rotasjon",
          sets: "2",
          reps: "1",
          weight: "25",
          holdSeconds: "",
          restSeconds: "30",
          notes: "",
        },
        "Mobilitet",
      ).weight,
    ).toBe("");
  });
});
