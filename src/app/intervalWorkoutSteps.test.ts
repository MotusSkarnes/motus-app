import { describe, expect, it } from "vitest";
import { buildIntervalProgramSteps, countIntervalWorkSteps } from "./intervalWorkoutSteps";
import type { Exercise, ProgramExercise, TrainingProgram } from "./types";

const rowingBank: Exercise = {
  id: "ex-row",
  name: "Roing",
  category: "Kondisjon",
  group: "Kondisjon",
  equipment: "Romaskin",
  level: "Litt øvet",
  description: "",
};

function cardioRow(partial: Partial<ProgramExercise> & Pick<ProgramExercise, "id" | "exerciseName">): ProgramExercise {
  return {
    exerciseId: "ex-row",
    sets: "1",
    reps: "",
    weight: "",
    durationMinutes: "1",
    holdSeconds: "",
    restSeconds: "0",
    speed: "",
    incline: "",
    notes: "",
    ...partial,
  };
}

function program(exercises: ProgramExercise[]): TrainingProgram {
  return {
    id: "p1",
    memberId: "m1",
    title: "Romaskin intervall",
    goal: "",
    notes: "",
    createdAt: "01.01.2026",
    exercises,
  };
}

describe("buildIntervalProgramSteps", () => {
  it("expands one drag row with sets=10 into ten work intervals before cooldown", () => {
    const steps = buildIntervalProgramSteps(
      program([
        cardioRow({ id: "w", exerciseName: "Oppvarming", durationMinutes: "5", sets: "1" }),
        cardioRow({ id: "d", exerciseName: "Drag 1", sets: "10", durationMinutes: "1", restSeconds: "60" }),
        cardioRow({ id: "c", exerciseName: "Nedtrapping", durationMinutes: "5", sets: "1" }),
      ]),
      [rowingBank],
    );
    const workHeadlines = steps.filter((s) => s.tone === "work").map((s) => s.headline);
    expect(countIntervalWorkSteps(steps)).toBe(10);
    expect(workHeadlines.filter((h) => h.startsWith("Drag"))).toHaveLength(10);
    expect(steps.at(-1)?.tone).toBe("cooldown");
  });

  it("runs all drag rows before cooldown when nedtrapping was added early in builder", () => {
    const steps = buildIntervalProgramSteps(
      program([
        cardioRow({ id: "w", exerciseName: "Oppvarming", durationMinutes: "5" }),
        cardioRow({ id: "d1", exerciseName: "Drag 1", durationMinutes: "1" }),
        cardioRow({ id: "d2", exerciseName: "Drag 2", durationMinutes: "1" }),
        cardioRow({ id: "c", exerciseName: "Nedtrapping", durationMinutes: "5" }),
      ]),
      [rowingBank],
    );
    const work = steps.filter((s) => s.tone === "work");
    expect(work.map((s) => s.headline)).toEqual(["Drag 1", "Drag 2"]);
    expect(steps.find((s) => s.tone === "warmup")?.headline).toBe("Oppvarming");
    expect(steps.at(-1)?.tone).toBe("cooldown");
  });
});
