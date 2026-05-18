import { describe, expect, it } from "vitest";
import {
  buildExerciseCategoryById,
  filterTemplateProgramsBySubTab,
  isConditioningTrainingProgram,
  isStrengthTrainingProgram,
} from "./trainingProgramKind";
import type { Exercise, TrainingProgram } from "./types";

const exercises: Exercise[] = [
  { id: "e1", name: "Bøy", category: "Styrke", group: "Bein", equipment: "Stang", level: "Nybegynner", description: "" },
  { id: "e2", name: "Mølle", category: "Kondisjon", group: "Bein", equipment: "Tredemølle", level: "Nybegynner", description: "" },
];

const categories = buildExerciseCategoryById(exercises);

function program(exerciseId: string, durationMinutes?: string): TrainingProgram {
  return {
    id: "p1",
    memberId: "__template__",
    title: "Test",
    goal: "",
    notes: "",
    createdAt: "",
    exercises: [
      {
        id: "x1",
        exerciseId,
        exerciseName: "Steg",
        sets: "1",
        reps: "",
        weight: "",
        durationMinutes: durationMinutes ?? "",
        restSeconds: "0",
        notes: "",
      },
    ],
  };
}

describe("trainingProgramKind", () => {
  it("classifies interval programs as conditioning", () => {
    expect(isConditioningTrainingProgram(program("e2", "4"), categories)).toBe(true);
    expect(isStrengthTrainingProgram(program("e2", "4"), categories)).toBe(false);
  });

  it("classifies strength programs separately", () => {
    expect(isStrengthTrainingProgram(program("e1"), categories)).toBe(true);
    expect(isConditioningTrainingProgram(program("e1"), categories)).toBe(false);
  });

  it("filters template lists by sub tab", () => {
    const templates = [program("e1"), program("e2", "10")];
    expect(filterTemplateProgramsBySubTab(templates, "strength", categories)).toHaveLength(1);
    expect(filterTemplateProgramsBySubTab(templates, "conditioning", categories)).toHaveLength(1);
  });
});
