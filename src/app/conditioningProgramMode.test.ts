import { describe, expect, it } from "vitest";
import {
  buildConditioningProgramNotes,
  enrichProgramWithConditioningMode,
  isConditioningLogAfterProgram,
  parseConditioningDeliveryMode,
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
});
