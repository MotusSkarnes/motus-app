import { describe, expect, it } from "vitest";
import {
  buildConditioningProgramNotes,
  enrichProgramWithConditioningMode,
  isConditioningLogAfterProgram,
  parseConditioningDeliveryMode,
  serializeConditioningProgramNotes,
  stripConditioningModeMarker,
  stripLogFieldKeysFromExercises,
} from "./conditioningProgramMode";
import type { TrainingProgram } from "./types";

function program(notes: string): TrainingProgram {
  return {
    id: "p1",
    memberId: "__template__",
    title: "Test",
    goal: "",
    notes,
    createdAt: "",
    exercises: [],
  };
}

describe("conditioningProgramMode", () => {
  it("parses and strips mode marker from notes", () => {
    const raw = buildConditioningProgramNotes("logAfter", "Løpetur");
    expect(parseConditioningDeliveryMode(program(raw))).toBe("logAfter");
    const enriched = enrichProgramWithConditioningMode(program(raw));
    expect(enriched.conditioningDeliveryMode).toBe("logAfter");
    expect(enriched.notes).toBe("Løpetur");
    expect(stripConditioningModeMarker(raw)).toBe("Løpetur");
  });

  it("detects log-after programs", () => {
    expect(isConditioningLogAfterProgram(program(buildConditioningProgramNotes("logAfter", "")))).toBe(true);
    expect(isConditioningLogAfterProgram({ notes: "", conditioningDeliveryMode: "interval" })).toBe(false);
  });

  it("infers log-after from exercise logFieldKeys when notes marker is missing", () => {
    const program: TrainingProgram = {
      id: "p2",
      memberId: "m1",
      title: "Løping",
      goal: "",
      notes: "",
      createdAt: "",
      exercises: [
        {
          id: "ex1",
          exerciseId: "e1",
          exerciseName: "Løping",
          sets: "1",
          reps: "",
          weight: "",
          holdSeconds: "30",
          durationMinutes: "30",
          restSeconds: "30",
          logFieldKeys: ["minutes", "distance"],
          notes: "",
        },
      ],
    };
    expect(isConditioningLogAfterProgram(program)).toBe(true);
    const enriched = enrichProgramWithConditioningMode(program);
    expect(enriched.conditioningDeliveryMode).toBe("logAfter");
    expect(enriched.exercises[0]?.holdSeconds).toBe("");
    expect(enriched.exercises[0]?.restSeconds).toBe("");
    expect(enriched.exercises[0]?.durationMinutes).toBe("30");
  });

  it("serializes mode back into notes after enrich stripped the marker", () => {
    const enriched = enrichProgramWithConditioningMode(program(buildConditioningProgramNotes("logAfter", "Løpetur")));
    expect(enriched.notes).toBe("Løpetur");
    expect(enriched.conditioningDeliveryMode).toBe("logAfter");
    expect(serializeConditioningProgramNotes(enriched)).toBe("__motusConditioningMode=logAfter\nLøpetur");
  });

  it("strips stale logFieldKeys when enriching explicit interval programs", () => {
    const intervalProgram: TrainingProgram = {
      id: "p3",
      memberId: "m1",
      title: "4x4 intervall",
      goal: "",
      notes: buildConditioningProgramNotes("interval", "Hard økt"),
      createdAt: "",
      exercises: [
        {
          id: "ex1",
          exerciseId: "e1",
          exerciseName: "Drag 1",
          sets: "4",
          reps: "",
          weight: "",
          holdSeconds: "",
          durationMinutes: "4",
          restSeconds: "180",
          logFieldKeys: ["minutes", "distance"],
          notes: "",
        },
      ],
    };
    const enriched = enrichProgramWithConditioningMode(intervalProgram);
    expect(enriched.conditioningDeliveryMode).toBe("interval");
    expect(enriched.exercises[0]?.logFieldKeys).toBeUndefined();
    expect(enriched.exercises[0]?.durationMinutes).toBe("4");
    expect(stripLogFieldKeysFromExercises(intervalProgram.exercises)[0]?.logFieldKeys).toBeUndefined();
  });
});
