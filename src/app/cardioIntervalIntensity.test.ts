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
    ...partial,
  };
}

describe("cardioIntervalIntensity", () => {
  it("applies presets per phase", () => {
    const drag = applyCardioIntensityToExercise(row({ exerciseName: "Drag 1" }), "high");
    expect(drag.targetHrPercent).toBe("88–95");
    expect(drag.speed).toBe("14");

    const warmup = applyCardioIntensityToExercise(row({ exerciseName: "Oppvarming" }), "low");
    expect(warmup.targetHrPercent).toBe("60–70");
    expect(warmup.speed).toBe("6.5");
  });

  it("infers intensity from target hr", () => {
    expect(
      inferCardioIntensityFromExercise(
        row({ exerciseName: "Drag 2", targetHrPercent: "88–95", speed: "14" }),
      ),
    ).toBe("high");
  });

  it("updates all interval rows in draft", () => {
    const draft = applyCardioIntensityToDraft(
      [
        row({ id: "w", exerciseName: "Oppvarming", durationMinutes: "10" }),
        row({ id: "d", exerciseName: "Drag 1", durationMinutes: "4" }),
      ],
      "low",
      { conditioningBuilder: true },
    );
    expect(draft[0].targetHrPercent).toBe("60–70");
    expect(draft[1].targetHrPercent).toBe("75–82");
  });

  it("labels intensity for display", () => {
    expect(cardioIntensityDisplayLabel("medium")).toBe("Middels");
  });
});
