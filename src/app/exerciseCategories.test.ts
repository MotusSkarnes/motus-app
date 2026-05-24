import { describe, expect, it } from "vitest";
import {
  exerciseCategoryAccentColor,
  exerciseCategoryTagClass,
  normalizeProgramExerciseForCategory,
  programDraftUsesHoldFields,
  programExerciseHoldSeconds,
} from "./exerciseCategories";
import { MOTUS_COLORS } from "./designSystem";

describe("exerciseCategory colors", () => {
  it("uses Motus palette for category accents", () => {
    expect(exerciseCategoryAccentColor("Styrke")).toBe("#0f766e");
    expect(exerciseCategoryAccentColor("Kondisjon")).toBe(MOTUS_COLORS.pink);
    expect(exerciseCategoryAccentColor("Mobilitet")).toBe("#0891b2");
    expect(exerciseCategoryAccentColor("Rehab")).toBe("#9333ea");
  });

  it("maps categories to exbank tag classes", () => {
    expect(exerciseCategoryTagClass("Styrke")).toBe("motus-exbank-tag--cat-styrke");
    expect(exerciseCategoryTagClass("Kondisjon")).toBe("motus-exbank-tag--cat-kondisjon");
    expect(exerciseCategoryTagClass("Uttøyning")).toBe("motus-exbank-tag--cat-uttoyning");
  });
});

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
