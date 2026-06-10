import { describe, expect, it } from "vitest";
import {
  buildConditioningProgramNotes,
  enrichProgramWithConditioningMode,
  isConditioningLogAfterProgram,
  parseConditioningDeliveryMode,
  serializeConditioningProgramNotes,
  stripConditioningModeMarker,
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
  });

  it("serializes mode back into notes after enrich stripped the marker", () => {
    const enriched = enrichProgramWithConditioningMode(program(buildConditioningProgramNotes("logAfter", "Løpetur")));
    expect(enriched.notes).toBe("Løpetur");
    expect(enriched.conditioningDeliveryMode).toBe("logAfter");
    expect(serializeConditioningProgramNotes(enriched)).toBe("__motusConditioningMode=logAfter\nLøpetur");
  });
});
