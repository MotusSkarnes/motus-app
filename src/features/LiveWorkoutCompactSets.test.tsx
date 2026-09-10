import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WorkoutCompactSetTable, type WorkoutSetRow } from "./LiveWorkoutCompactSets";
import type { Exercise } from "../app/types";

const squat: Exercise = {
  id: "ex-squat",
  name: "Knebøy",
  category: "Styrke",
  group: "Bein",
  equipment: "Stang",
  level: "Nybegynner",
  description: "",
};

const plank: Exercise = {
  id: "ex-plank",
  name: "Planke",
  category: "Styrke",
  group: "Kjerne",
  equipment: "Kroppsvekt",
  level: "Nybegynner",
  description: "",
  prescriptionFields: ["seconds", "pause"],
};

function kgRow(overrides: Partial<WorkoutSetRow> = {}): WorkoutSetRow {
  return {
    exerciseId: "squat-set-1",
    programExerciseId: "pe-squat",
    setNumber: 1,
    exerciseName: "Knebøy",
    exerciseCategory: "Styrke",
    plannedSets: "3",
    plannedReps: "10",
    plannedRepsUnit: "reps",
    plannedWeight: "80",
    plannedWeightUnit: "kg",
    performedWeight: "80",
    performedReps: "10",
    performedLoadUnit: "kg",
    completed: false,
    ...overrides,
  };
}

function secRow(overrides: Partial<WorkoutSetRow> = {}): WorkoutSetRow {
  return {
    exerciseId: "plank-set-1",
    programExerciseId: "pe-plank",
    setNumber: 1,
    exerciseName: "Planke",
    exerciseCategory: "Styrke",
    plannedSets: "3",
    plannedReps: "1",
    plannedRepsUnit: "reps",
    plannedWeight: "45",
    plannedWeightUnit: "seconds",
    performedWeight: "45",
    performedReps: "1",
    performedLoadUnit: "sec",
    completed: false,
    ...overrides,
  };
}

describe("WorkoutCompactSetTable load labels", () => {
  afterEach(() => cleanup());

  it("shows Vekt (Kg) and REPS for kg exercises, without a unit switcher", () => {
    const exerciseByName = new Map([["knebøy", squat]]);
    render(
      <WorkoutCompactSetTable
        rows={[kgRow()]}
        exerciseByName={exerciseByName}
        onUpdate={vi.fn()}
      />,
    );
    expect(screen.getAllByText("Vekt (Kg)").length).toBeGreaterThan(0);
    expect(screen.getByText("REPS")).toBeTruthy();
    expect(screen.queryByLabelText("Velg måleenhet")).toBeNull();
    expect(screen.queryByText("VEKT (SEK)")).toBeNull();
    expect(screen.queryByText("VEKT (KG)")).toBeNull();
  });

  it("shows SEK instead of reps and kg for seconds exercises", () => {
    const exerciseByName = new Map([["planke", plank]]);
    render(
      <WorkoutCompactSetTable
        rows={[secRow()]}
        exerciseByName={exerciseByName}
        onUpdate={vi.fn()}
      />,
    );
    expect(screen.getAllByText("SEK").length).toBeGreaterThan(0);
    expect(screen.queryByText("REPS")).toBeNull();
    expect(screen.queryByText("Vekt (Kg)")).toBeNull();
    expect(screen.queryByLabelText("Velg måleenhet")).toBeNull();
  });

  it("shows REPS without SEK or kg for reps-only rehab exercises", () => {
    const diagonal: Exercise = {
      id: "ex-diag",
      name: "Diagonal hev",
      category: "Rehab",
      group: "Skulder",
      equipment: "Strikk",
      level: "Nybegynner",
      description: "",
      prescriptionFields: ["reps"],
    };
    const row: WorkoutSetRow = {
      exerciseId: "diag-set-1",
      programExerciseId: "pe-diag",
      setNumber: 1,
      exerciseName: "Diagonal hev",
      exerciseCategory: "Rehab",
      plannedSets: "3",
      plannedReps: "10",
      plannedRepsUnit: "reps",
      plannedWeight: "",
      plannedWeightUnit: "kg",
      performedWeight: "",
      performedReps: "10",
      performedLoadUnit: "kg",
      completed: false,
    };
    render(
      <WorkoutCompactSetTable
        rows={[row]}
        exerciseByName={new Map([["diagonal hev", diagonal]])}
        onUpdate={vi.fn()}
      />,
    );
    expect(screen.getAllByText("REPS").length).toBeGreaterThan(0);
    expect(screen.queryByText("SEK")).toBeNull();
    expect(screen.queryByText("Vekt (Kg)")).toBeNull();
  });
});
