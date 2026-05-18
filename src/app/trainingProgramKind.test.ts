import { describe, expect, it } from "vitest";
import { exerciseMatchesSubTab } from "./exerciseCategories";
import {
  buildExerciseCategoryById,
  filterTemplateProgramsBySubTab,
  getTrainingProgramSubTab,
  isConditioningTrainingProgram,
} from "./trainingProgramKind";
import type { Exercise, TrainingProgram } from "./types";

const exercises: Exercise[] = [
  { id: "e1", name: "Bøy", category: "Styrke", group: "Bein", equipment: "Stang", level: "Nybegynner", description: "" },
  { id: "e2", name: "Mølle", category: "Kondisjon", group: "Bein", equipment: "Tredemølle", level: "Nybegynner", description: "" },
  { id: "e3", name: "Strekk", category: "Uttøyning", group: "Hofte", equipment: "Kroppsvekt", level: "Nybegynner", description: "" },
  { id: "e4", name: "Band", category: "Rehab", group: "Skulder", equipment: "Strikk", level: "Nybegynner", description: "" },
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
    expect(getTrainingProgramSubTab(program("e2", "4"), categories)).toBe("conditioning");
  });

  it("classifies mobility and rehab templates", () => {
    expect(getTrainingProgramSubTab(program("e3"), categories)).toBe("mobility");
    expect(getTrainingProgramSubTab(program("e4"), categories)).toBe("rehab");
    expect(getTrainingProgramSubTab(program("e1"), categories)).toBe("strength");
  });

  it("filters template lists by sub tab", () => {
    const templates = [program("e1"), program("e2", "10"), program("e3"), program("e4")];
    expect(filterTemplateProgramsBySubTab(templates, "strength", categories)).toHaveLength(1);
    expect(filterTemplateProgramsBySubTab(templates, "conditioning", categories)).toHaveLength(1);
    expect(filterTemplateProgramsBySubTab(templates, "mobility", categories)).toHaveLength(1);
    expect(filterTemplateProgramsBySubTab(templates, "rehab", categories)).toHaveLength(1);
  });

  it("matches exercise bank sub tabs by category", () => {
    expect(exerciseMatchesSubTab("Kondisjon", "conditioning")).toBe(true);
    expect(exerciseMatchesSubTab("Styrke", "strength")).toBe(true);
    expect(exerciseMatchesSubTab("Uttøyning", "mobility")).toBe(true);
    expect(exerciseMatchesSubTab("Mobilitet", "mobility")).toBe(true);
    expect(exerciseMatchesSubTab("Rehab", "rehab")).toBe(true);
    expect(exerciseMatchesSubTab("Uttøyning", "strength")).toBe(false);
  });
});
