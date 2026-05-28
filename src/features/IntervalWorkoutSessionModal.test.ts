import { describe, expect, it } from "vitest";
import type { ProgramExercise, TrainingProgram } from "../app/types";
import { buildIntervalProgramSteps } from "./IntervalWorkoutSessionModal";

function intervalLine(id: string, overrides: Partial<ProgramExercise>): ProgramExercise {
  return {
    id,
    exerciseId: id,
    exerciseName: "Drag",
    sets: "1",
    reps: "",
    weight: "",
    durationMinutes: "4",
    speed: "12",
    incline: "2",
    targetHrPercent: "90",
    restSeconds: "180",
    notes: "",
    ...overrides,
  };
}

function program(title: string, exercises: ProgramExercise[]): TrainingProgram {
  return {
    id: "program-1",
    memberId: "member-1",
    title,
    goal: "",
    notes: "",
    createdAt: "20.05.2026",
    exercises,
  };
}

describe("buildIntervalProgramSteps", () => {
  it("keeps the programmed pause between multi-set drag blocks", () => {
    const steps = buildIntervalProgramSteps(
      program("Intervall", [
        intervalLine("drag-1", { exerciseName: "Drag", sets: "4", restSeconds: "180" }),
        intervalLine("drag-2", { exerciseName: "Drag", sets: "1", restSeconds: "180" }),
        intervalLine("cooldown", { exerciseName: "Nedjogg", sets: "1", durationMinutes: "5", restSeconds: "0", speed: "7" }),
      ]),
    );

    expect(steps.map((step) => `${step.headline}:${step.durationSeconds}`)).toEqual([
      "Drag 1:240",
      "Pause:180",
      "Drag 2:240",
      "Pause:180",
      "Drag 3:240",
      "Pause:180",
      "Drag 4:240",
      "Pause:180",
      "Drag 5:240",
      "Nedjogg:300",
    ]);
    expect(steps[7]?.afterExerciseName).toBe("Drag 4");
  });

  it("uses the legacy 4x4 pause fallback between separate blank-rest drag rows", () => {
    const steps = buildIntervalProgramSteps(
      program("4x4 intervall", [
        intervalLine("drag-1", { exerciseName: "Drag 1", sets: "1", restSeconds: "" }),
        intervalLine("drag-2", { exerciseName: "Drag 2", sets: "1", restSeconds: "" }),
        intervalLine("cooldown", { exerciseName: "Nedjogg", sets: "1", durationMinutes: "5", restSeconds: "0", speed: "7" }),
      ]),
    );

    expect(steps.map((step) => `${step.headline}:${step.durationSeconds}`)).toEqual([
      "Drag 1:240",
      "Pause:180",
      "Drag 2:240",
      "Nedjogg:300",
    ]);
  });
});
