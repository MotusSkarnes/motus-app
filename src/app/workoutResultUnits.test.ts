import { describe, expect, it } from "vitest";
import { resolveWorkoutLoadUnit } from "./workoutResultUnits";

describe("resolveWorkoutLoadUnit", () => {
  it("prefers an explicit performed seconds unit", () => {
    expect(resolveWorkoutLoadUnit({ performedLoadUnit: "sec", plannedWeightUnit: "kg" })).toBe("sec");
  });

  it("keeps kg when the set was logged as kg", () => {
    expect(resolveWorkoutLoadUnit({ performedLoadUnit: "kg", plannedWeightUnit: "seconds" })).toBe("kg");
  });

  it("uses planned seconds when performed unit is unset", () => {
    expect(resolveWorkoutLoadUnit({ plannedWeightUnit: "seconds" })).toBe("sec");
  });

  it("defaults ordinary strength to kg", () => {
    expect(resolveWorkoutLoadUnit({ plannedWeightUnit: "kg", exerciseCategory: "Styrke" })).toBe("kg");
  });
});
