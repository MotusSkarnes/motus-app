import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LiveWorkoutSessionModal } from "../features/LiveWorkoutSessionModal";
import { expandProgramExercisesToWorkoutResults } from "./programBlocks";
import { normalizeProgramExercises } from "./normalizeProgramExercise";
import { enrichProgramWithConditioningMode } from "./conditioningProgramMode";
import type { Exercise, TrainingProgram, WorkoutModeState } from "./types";

const bank: Exercise[] = [
  { id: "e5", name: "Beinpress", category: "Styrke", group: "Bein", equipment: "Maskin", level: "Nybegynner", description: "" },
  { id: "ex-yjuaz1e", name: "Nedtrekk smalt grep", category: "Styrke", group: "Rygg", equipment: "Maskin", level: "Nybegynner", description: "" },
  { id: "e197", name: "Leg extension i maskin NR 24", category: "Styrke", group: "Bein", equipment: "Maskin", level: "Nybegynner", description: "" },
  { id: "e12", name: "Skrå manualpress", category: "Styrke", group: "Bryst", equipment: "Manualer", level: "Nybegynner", description: "" },
  { id: "e196", name: "Leg curl i maskin NR 23", category: "Styrke", group: "Bein", equipment: "Maskin", level: "Nybegynner", description: "" },
  { id: "e199", name: "Sittende ro i maskin nr 20", category: "Styrke", group: "Rygg", equipment: "Maskin", level: "Nybegynner", description: "" },
  { id: "ex-2jhxx78", name: "Utside lår NR 7", category: "Styrke", group: "Bein", equipment: "Maskin", level: "Nybegynner", description: "" },
  { id: "ex-5lljt5y", name: "Innside lår NR 6", category: "Styrke", group: "Bein", equipment: "Maskin", level: "Nybegynner", description: "" },
  { id: "e32", name: "Russian twist", category: "Styrke", group: "Core", equipment: "Kroppsvekt", level: "Nybegynner", description: "" },
  { id: "e215", name: "Goblet squat", category: "Styrke", group: "Bein", equipment: "Kettlebell", level: "Nybegynner", description: "" },
  { id: "e22", name: "Enarms roing", category: "Styrke", group: "Rygg", equipment: "Manualer", level: "Nybegynner", description: "" },
  { id: "e20", name: "Nedtrekk bredt grep", category: "Styrke", group: "Rygg", equipment: "Maskin", level: "Nybegynner", description: "" },
  { id: "e16", name: "Skulderpress", category: "Styrke", group: "Skulder", equipment: "Manualer", level: "Nybegynner", description: "" },
  { id: "ex-fwgr4km", name: "Supermann i slynge", category: "Styrke", group: "Rygg", equipment: "Slynge", level: "Nybegynner", description: "" },
  { id: "ex-oat0pr0", name: "Diagonal hev", category: "Rehab", group: "Skulder", equipment: "Strikk", level: "Nybegynner", description: "" },
];

function helkropp(): TrainingProgram {
  return enrichProgramWithConditioningMode({
    id: "38e82a6b-7c04-4f5e-8d5d-152564b985a3",
    memberId: "member-4k47wxi",
    title: "Helkropp",
    goal: "Bli sterkere",
    notes: "",
    createdAt: "2026-05-21",
    exercises: normalizeProgramExercises([
      { id: "draft-ex-4o63bjx", exerciseId: "e5", exerciseName: "Beinpress", sets: "3", reps: "12", weight: "30", restSeconds: "90", notes: "" },
      { id: "prog-ex-h96at3d", exerciseId: "ex-yjuaz1e", exerciseName: "Nedtrekk smalt grep", sets: "3", reps: "12", weight: "20", restSeconds: "90", notes: "" },
      { id: "prog-ex-n8572zi", exerciseId: "e197", exerciseName: "Leg extension i maskin NR 24", sets: "3", reps: "12", weight: "15", restSeconds: "90", notes: "" },
      { id: "prog-ex-udj2pcu", exerciseId: "e12", exerciseName: "Skrå manualpress", sets: "3", reps: "10", weight: "6", restSeconds: "90", notes: "" },
      { id: "prog-ex-0x1ugz8", exerciseId: "e196", exerciseName: "Leg curl i maskin NR 23", sets: "3", reps: "12", weight: "20", restSeconds: "90", notes: "" },
      { id: "prog-ex-hxqs8nw", exerciseId: "e199", exerciseName: "Sittende ro i maskin nr 20", sets: "3", reps: "12", weight: "25", restSeconds: "90", notes: "" },
      { id: "prog-ex-g4dlyji", exerciseId: "ex-2jhxx78", exerciseName: "Utside lår NR 7", sets: "3", reps: "12", weight: "25", restSeconds: "90", notes: "" },
      { id: "draft-ex-k74920k", exerciseId: "ex-5lljt5y", exerciseName: "Innside lår NR 6", sets: "3", reps: "12", weight: "25", restSeconds: "90", notes: "" },
      { id: "prog-ex-ovs1my7", exerciseId: "e32", exerciseName: "Russian twist", sets: "3", reps: "12", weight: "3", restSeconds: "90", notes: "" },
    ]),
  });
}

function nyttProgram(): TrainingProgram {
  return enrichProgramWithConditioningMode({
    id: "b7246702-5c8b-4eb8-b281-90f514e67311",
    memberId: "member-4k47wxi",
    title: "Nytt treningsprogram",
    goal: "",
    notes: "__motusConditioningMode=interval\nNye øvelser juli-2026",
    createdAt: "2026-07-01",
    exercises: normalizeProgramExercises([
      { id: "prog-ex-uqzzh06", exerciseId: "e215", exerciseName: "Goblet squat", sets: "3", reps: "10", weight: "0", restSeconds: "90", notes: "" },
      { id: "prog-ex-tr9kszo", exerciseId: "e22", exerciseName: "Enarms roing", sets: "3", reps: "10", weight: "0", restSeconds: "90", notes: "" },
      { id: "prog-ex-qoq9xqj", exerciseId: "e196", exerciseName: "Leg curl i maskin NR 23", sets: "3", reps: "10", weight: "0", restSeconds: "90", notes: "" },
      { id: "prog-ex-dwpvuut", exerciseId: "e12", exerciseName: "Skrå manualpress", sets: "3", reps: "10", weight: "0", restSeconds: "90", notes: "" },
      { id: "prog-ex-tp5lbdu", exerciseId: "e197", exerciseName: "Leg extension i maskin NR 24", sets: "3", reps: "10", weight: "0", restSeconds: "90", notes: "" },
      { id: "prog-ex-56uqg7k", exerciseId: "e20", exerciseName: "Nedtrekk bredt grep", sets: "3", reps: "10", weight: "0", restSeconds: "90", notes: "" },
      { id: "prog-ex-t7faf9n", exerciseId: "e16", exerciseName: "Skulderpress", sets: "3", reps: "10", weight: "0", restSeconds: "90", notes: "" },
      { id: "prog-ex-b6uqr05", exerciseId: "ex-fwgr4km", exerciseName: "Supermann i slynge", sets: "3", reps: "10", weight: "0", restSeconds: "90", notes: "" },
      { id: "prog-ex-48m7uyw", exerciseId: "e32", exerciseName: "Russian twist", sets: "3", reps: "10", weight: "0", restSeconds: "90", notes: "" },
      { id: "prog-ex-ls9sfgh", exerciseId: "ex-oat0pr0", exerciseName: "Diagonal hev", sets: "3", reps: "10", weight: "", restSeconds: "", notes: "" },
    ]),
  });
}

function workoutModeFor(program: TrainingProgram): WorkoutModeState {
  const results = expandProgramExercisesToWorkoutResults(program.exercises, bank, { program });
  return {
    programId: program.id,
    memberId: program.memberId,
    programTitle: program.title,
    results,
    note: "",
  };
}

const noop = vi.fn();

describe("LiveWorkoutSessionModal with Laila programs", () => {
  afterEach(() => cleanup());

  it("renders Helkropp session", () => {
    const program = helkropp();
    render(
      <LiveWorkoutSessionModal
        variant="member"
        workoutMode={workoutModeFor(program)}
        activeProgram={program}
        exercises={bank}
        updateWorkoutExerciseResult={noop}
        replaceWorkoutExerciseGroup={noop}
        addWorkoutExerciseToWorkout={noop}
        appendWorkoutSetForProgramExercise={noop}
        removeLastWorkoutSetForProgramExercise={noop}
        deferWorkoutExerciseGroup={noop}
        updateWorkoutModeNote={noop}
        updateWorkoutExerciseNote={noop}
        finishWorkoutMode={noop}
        cancelWorkoutMode={noop}
        onDismissWorkout={noop}
      />,
    );
    expect(screen.getByText("Helkropp")).toBeTruthy();
    expect(screen.getAllByText(/Beinpress/i).length).toBeGreaterThan(0);
  });

  it("renders Nytt treningsprogram session including rehab exercise", () => {
    const program = nyttProgram();
    render(
      <LiveWorkoutSessionModal
        variant="member"
        workoutMode={workoutModeFor(program)}
        activeProgram={program}
        exercises={bank}
        updateWorkoutExerciseResult={noop}
        replaceWorkoutExerciseGroup={noop}
        addWorkoutExerciseToWorkout={noop}
        appendWorkoutSetForProgramExercise={noop}
        removeLastWorkoutSetForProgramExercise={noop}
        deferWorkoutExerciseGroup={noop}
        updateWorkoutModeNote={noop}
        updateWorkoutExerciseNote={noop}
        finishWorkoutMode={noop}
        cancelWorkoutMode={noop}
        onDismissWorkout={noop}
      />,
    );
    expect(screen.getByText("Nytt treningsprogram")).toBeTruthy();
    expect(screen.getAllByText(/Goblet squat/i).length).toBeGreaterThan(0);
  });
});
