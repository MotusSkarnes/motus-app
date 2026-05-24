import { describe, expect, it } from "vitest";
import {
  STRENGTH_TRAINING_COVER_IMAGE,
  programCoverUsesPhotoStyle,
  resolveProgramImageSrc,
} from "./programImage";
import { RUNNER_STRENGTH_COVER_IMAGE, SUB60_PROGRAM_TITLES } from "./inspirationRunningPlans";
import type { Exercise, TrainingProgram } from "./types";

const strengthExercise: Pick<Exercise, "id" | "imageUrl" | "category" | "group" | "name"> = {
  id: "e1",
  name: "Benkpress",
  category: "Styrke",
  group: "Bryst",
  imageUrl: "/exercises/bench.png",
};

const program = (imageUrl?: string, title = "Helkropp"): Pick<TrainingProgram, "imageUrl" | "title"> => ({
  imageUrl,
  title,
});

describe("resolveProgramImageSrc", () => {
  it("prefers custom program cover", () => {
    expect(
      resolveProgramImageSrc(program("/program-covers/custom.png"), strengthExercise, { subTab: "strength" }),
    ).toBe("/program-covers/custom.png");
  });

  it("uses strength default cover for styrkeprogrammer", () => {
    expect(resolveProgramImageSrc(program(), strengthExercise, { subTab: "strength" })).toBe(
      STRENGTH_TRAINING_COVER_IMAGE,
    );
  });

  it("uses runner strength cover for styrke løper-programmer", () => {
    expect(
      resolveProgramImageSrc(program(undefined, SUB60_PROGRAM_TITLES.strength), strengthExercise, {
        subTab: "strength",
      }),
    ).toBe(RUNNER_STRENGTH_COVER_IMAGE);
  });

  it("falls back to exercise illustration for non-strength programs", () => {
    expect(resolveProgramImageSrc(program(), strengthExercise, { subTab: "mobility" })).toBe("/exercises/bench.png");
  });
});

describe("programCoverUsesPhotoStyle", () => {
  it("treats strength default cover as photo style", () => {
    expect(programCoverUsesPhotoStyle(program(), STRENGTH_TRAINING_COVER_IMAGE)).toBe(true);
  });
});
