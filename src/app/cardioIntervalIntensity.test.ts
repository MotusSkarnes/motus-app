import { describe, expect, it } from "vitest";
import {
  applyCardioIntensityToExercise,
  applyCardioIntensityToDraft,
  cardioIntensityDisplayLabel,
  inferCardioIntensityFromExercise,
} from "./cardioIntervalIntensity";
import type { ProgramExercise } from "./types";

function row(partial: Partial<ProgramExercise> & Pick<ProgramExercise, "exerciseName">): ProgramExercise {
  return {
    id: "1",
    exerciseId: "ex",
    sets: "1",
    reps: "",
    weight: "",
    restSeconds: "0",
    notes: "",
    speed: "11",
    incline: "2",
    targetHrPercent: "80–85",
    ...partial,
  };
}

describe("cardioIntervalIntensity", () => {
  it("tags intensity without changing speed, incline or pulse", () => {
    const source = row({ exerciseName: "Drag 1" });
    const tagged = applyCardioIntensityToExercise(source, "high");
    expect(tagged.cardioIntensity).toBe("high");
    expect(tagged.speed).toBe("11");
    expect(tagged.incline).toBe("2");
    expect(tagged.targetHrPercent).toBe("80–85");
  });

  it("reads stored intensity from exercise", () => {
    expect(inferCardioIntensityFromExercise(row({ exerciseName: "Drag 1", cardioIntensity: "low" }))).toBe("low");
  });

  it("tags all interval rows in draft", () => {
    const draft = applyCardioIntensityToDraft(
      [row({ id: "w", exerciseName: "Oppvarming", durationMinutes: "10" }), row({ id: "d", exerciseName: "Drag 1" })],
      "medium",
      { conditioningBuilder: true },
    );
    expect(draft[0].cardioIntensity).toBe("medium");
    expect(draft[1].cardioIntensity).toBe("medium");
  });

  it("labels intensity for display", () => {
    expect(cardioIntensityDisplayLabel("medium")).toBe("Middels");
  });
});
