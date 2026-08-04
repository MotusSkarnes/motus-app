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

  it("preserves conditioning flags and custom prescription fields", () => {
    const exercise = normalizeProgramExercise(
      {
        id: "pe-cardio",
        exerciseId: "e-cardio",
        exerciseName: "Drag 1",
        sets: "4",
        reps: "",
        weight: "",
        restSeconds: "90",
        notes: "rolig",
        durationMinutes: "4",
        speed: "12",
        incline: "1",
        targetHrPercent: "85",
        cardioIntensity: "high",
        logFieldKeys: ["minutes", "distance", "heartRate", "bogus"],
        customField1: "120",
        customField2: "spm",
        seatSetting: "4",
        blockId: "b1",
        blockType: "circuit",
        blockRounds: "3",
        repsUnit: "minutes",
        weightUnit: "seconds",
        holdSeconds: "20",
        distanceKm: "1.2",
      },
      0,
    );
    expect(exercise.cardioIntensity).toBe("high");
    expect(exercise.logFieldKeys).toEqual(["minutes", "distance", "heartRate"]);
    expect(exercise.customField1).toBe("120");
    expect(exercise.customField2).toBe("spm");
    expect(exercise.seatSetting).toBe("4");
    expect(exercise.durationMinutes).toBe("4");
    expect(exercise.speed).toBe("12");
    expect(exercise.incline).toBe("1");
    expect(exercise.targetHrPercent).toBe("85");
    expect(exercise.distanceKm).toBe("1.2");
    expect(exercise.holdSeconds).toBe("20");
    expect(exercise.blockId).toBe("b1");
    expect(exercise.blockType).toBe("circuit");
    expect(exercise.blockRounds).toBe("3");
    expect(exercise.repsUnit).toBe("minutes");
    expect(exercise.weightUnit).toBe("seconds");
  });

  it("returns empty list for non-arrays", () => {
    expect(normalizeProgramExercises(null)).toEqual([]);
    expect(normalizeProgramExercises({})).toEqual([]);
  });
});
