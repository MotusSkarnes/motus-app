import { describe, expect, it } from "vitest";
import { exerciseMatchesExerciseBankTab, exerciseMatchesSubTab } from "./exerciseCategories";
import {
  buildExerciseCategoryById,
  filterTemplateProgramsBySubTab,
  getTrainingProgramSubTab,
  isConditioningTrainingProgram,
  trainingProgramCategoryLabel,
} from "./trainingProgramKind";
import type { Exercise, TrainingProgram } from "./types";

const exercises: Exercise[] = [
  { id: "e1", name: "Bøy", category: "Styrke", group: "Bein", equipment: "Stang", level: "Nybegynner", description: "" },
  { id: "e2", name: "Mølle", category: "Kondisjon", group: "Bein", equipment: "Tredemølle", level: "Nybegynner", description: "" },
  { id: "e3", name: "Strekk", category: "Uttøyning", group: "Hofte", equipment: "Kroppsvekt", level: "Nybegynner", description: "" },
  { id: "e4", name: "Band", category: "Rehab", group: "Skulder", equipment: "Strikk", level: "Nybegynner", description: "" },
];

const categories = buildExerciseCategoryById(exercises);

function programRow(
  exerciseId: string,
  exerciseName: string,
  durationMinutes?: string,
): TrainingProgram["exercises"][number] {
  return {
    id: `x-${exerciseId}-${exerciseName}`,
    exerciseId,
    exerciseName,
    sets: "1",
    reps: "",
    weight: "",
    durationMinutes: durationMinutes ?? "",
    restSeconds: "0",
    notes: "",
  };
}

function program(exerciseId: string, durationMinutes?: string): TrainingProgram {
  return {
    id: "p1",
    memberId: "__template__",
    title: "Test",
    goal: "",
    notes: "",
    createdAt: "",
    exercises: [programRow(exerciseId, "Steg", durationMinutes)],
  };
}

function multiStepProgram(rows: TrainingProgram["exercises"]): TrainingProgram {
  return {
    id: "p-multi",
    memberId: "__template__",
    title: "Multi",
    goal: "",
    notes: "",
    createdAt: "",
    exercises: rows,
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
    expect(exerciseMatchesExerciseBankTab("Styrke", "all")).toBe(true);
    expect(exerciseMatchesExerciseBankTab("Rehab", "all")).toBe(true);
    expect(exerciseMatchesExerciseBankTab("Styrke", "conditioning")).toBe(false);
  });

  it("infers kondisjon from timed steps when exerciseId is missing", () => {
    const interval = program("unknown-id", "45");
    expect(getTrainingProgramSubTab(interval, categories, exercises)).toBe("conditioning");
    expect(trainingProgramCategoryLabel(interval, categories, exercises)).toBe("Kondisjon");
  });

  it("keeps pure strength programs as styrke", () => {
    const strength = multiStepProgram([
      programRow("e1", "Bøy"),
      programRow("e1", "Benk"),
    ]);
    expect(trainingProgramCategoryLabel(strength, categories, exercises)).toBe("Styrke");
  });

  it("ignores nedjogg when classifying interval programs", () => {
    const interval = multiStepProgram([
      programRow("e2", "Oppvarming", "8"),
      programRow("e2", "Drag 1", "4"),
      programRow("unknown", "Nedjogg", "5"),
    ]);
    expect(isConditioningTrainingProgram(interval, categories, exercises)).toBe(true);
    expect(trainingProgramCategoryLabel(interval, categories, exercises)).toBe("Kondisjon");
  });

  it("resolves category by exercise name when id is stale", () => {
    const byName = programRow("stale-id", "Mølle", "30");
    const resolved = multiStepProgram([byName]);
    expect(trainingProgramCategoryLabel(resolved, categories, exercises)).toBe("Kondisjon");
  });

  it("classifies mobility programs even without exercise bank matches", () => {
    const mobility = multiStepProgram([
      programRow("unknown-1", "World's greatest stretch"),
      programRow("unknown-2", "Couch stretch", "", "45"),
    ]);
    mobility.exercises[1] = {
      ...mobility.exercises[1]!,
      reps: "",
      holdSeconds: "45",
      notes: "Per side",
    };
    expect(trainingProgramCategoryLabel(mobility, new Map(), [])).toBe("Mobilitet");
  });

  it("prefers exercise name over stale id category", () => {
    const staleCategories = buildExerciseCategoryById([
      { id: "stale-id", name: "Other", category: "Styrke", group: "Bein", equipment: "Stang", level: "Nybegynner", description: "" },
    ]);
    const row = programRow("stale-id", "Mølle", "30");
    expect(trainingProgramCategoryLabel(multiStepProgram([row]), staleCategories, exercises)).toBe("Kondisjon");
  });
});
