import { describe, expect, it } from "vitest";
import { enrichProgramWithConditioningMode } from "./conditioningProgramMode";
import { isMemberIntervalWorkoutProgram } from "./memberIntervalWorkout";
import { expandProgramExercisesToWorkoutResults, buildWorkoutResultGroups } from "./programBlocks";
import { normalizeProgramExercises } from "./normalizeProgramExercise";
import { startWorkoutModeInState } from "../services/appRepository";
import { getDefaultState } from "./data";
import type { Exercise, TrainingProgram } from "./types";

const bank: Exercise[] = [
  { id: "e5", name: "Beinpress", category: "Styrke", group: "Bein", equipment: "Maskin", level: "Nybegynner", description: "" },
  { id: "e215", name: "Goblet squat", category: "Styrke", group: "Bein", equipment: "Kettlebell", level: "Nybegynner", description: "" },
  { id: "ex-oat0pr0", name: "Diagonal hev", category: "Rehab", group: "Skulder", equipment: "Strikk", level: "Nybegynner", description: "" },
];

function makeProgram(partial: Partial<TrainingProgram> & Pick<TrainingProgram, "id" | "title" | "exercises" | "notes">): TrainingProgram {
  return enrichProgramWithConditioningMode({
    memberId: "member-4k47wxi",
    goal: "",
    createdAt: "2026-05-21",
    ...partial,
    exercises: normalizeProgramExercises(partial.exercises),
  });
}

describe("Laila production programs open path", () => {
  it("does not treat Nytt treningsprogram as interval despite interval marker", () => {
    const program = makeProgram({
      id: "b7246702-5c8b-4eb8-b281-90f514e67311",
      title: "Nytt treningsprogram",
      notes: "__motusConditioningMode=interval\nNye øvelser juli-2026",
      exercises: [
        { id: "1", exerciseId: "e215", exerciseName: "Goblet squat", sets: "3", reps: "10", weight: "0", restSeconds: "90", notes: "" },
        { id: "2", exerciseId: "ex-oat0pr0", exerciseName: "Diagonal hev", sets: "3", reps: "10", weight: "", restSeconds: "", notes: "" },
      ],
    });
    expect(program.conditioningDeliveryMode).toBe("interval");
    const byId = new Map(bank.map((e) => [e.id, e.category]));
    expect(isMemberIntervalWorkoutProgram(program, byId, bank)).toBe(false);
  });

  it("can start Helkropp workout mode without throwing", () => {
    const program = makeProgram({
      id: "38e82a6b-7c04-4f5e-8d5d-152564b985a3",
      title: "Helkropp",
      notes: "",
      exercises: [
        { id: "1", exerciseId: "e5", exerciseName: "Beinpress", sets: "3", reps: "12", weight: "30", restSeconds: "90", notes: "" },
        { id: "2", exerciseId: "ex-oat0pr0", exerciseName: "Diagonal hev", sets: "3", reps: "10", weight: "", restSeconds: "", notes: "" },
      ],
    });
    const state = {
      ...getDefaultState(),
      programs: [program],
      exercises: bank,
    };
    expect(() => {
      const next = startWorkoutModeInState(state, program.id);
      expect(next.workoutMode).not.toBeNull();
      const results = expandProgramExercisesToWorkoutResults(program.exercises, bank, { program });
      buildWorkoutResultGroups(results, program);
    }).not.toThrow();
  });
});
