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

  it("expands Roing hoveddel with sets=10 without drag in exercise name (tre bolker via programmer)", () => {
    const steps = buildIntervalProgramSteps(
      program([
        cardioRow({ id: "w", exerciseName: "Roing", durationMinutes: "5", sets: "1", restSeconds: "0" }),
        cardioRow({ id: "m", exerciseName: "Roing", durationMinutes: "1", sets: "10", restSeconds: "60" }),
        cardioRow({ id: "c", exerciseName: "Nedtrapping", durationMinutes: "5", sets: "1" }),
      ]),
      [rowingBank],
    );
    expect(steps.find((s) => s.tone === "warmup")?.durationSeconds).toBe(5 * 60);
    expect(countIntervalWorkSteps(steps)).toBe(10);
    expect(steps.filter((s) => s.tone === "work" && s.headline.startsWith("Drag")).length).toBe(10);
    expect(steps.at(-1)?.tone).toBe("cooldown");
    expect(steps.at(-1)?.durationSeconds).toBe(5 * 60);
  });

  it("honors circuit block rounds when middle block is a sirkel with one timed exercise", () => {
    const blockId = "block-main";
    const steps = buildIntervalProgramSteps(
      program([
        cardioRow({ id: "w", exerciseName: "Oppvarming", durationMinutes: "5", sets: "1" }),
        {
          ...cardioRow({ id: "m", exerciseName: "Roing", durationMinutes: "1", sets: "10" }),
          blockId,
          blockType: "circuit",
          blockRounds: "10",
        },
        cardioRow({ id: "c", exerciseName: "Nedtrapping", durationMinutes: "5", sets: "1" }),
      ]),
      [rowingBank],
    );
    expect(countIntervalWorkSteps(steps)).toBe(10);
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
