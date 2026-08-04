import { describe, expect, it } from "vitest";
import { expandProgramExercisesToWorkoutResults, buildWorkoutResultGroups } from "./programBlocks";
import { normalizeProgramExercises } from "./normalizeProgramExercise";
import { isMemberIntervalWorkoutProgram } from "./memberIntervalWorkout";
import { getTrainingProgramSubTab } from "./trainingProgramKind";
import type { Exercise, TrainingProgram } from "./types";

const exercises: Exercise[] = [
  {
    id: "e5",
    name: "Beinpress",
    category: "Styrke",
    group: "Bein",
    equipment: "Maskin",
    level: "Nybegynner",
    description: "",
  },
  {
    id: "ex-oat0pr0",
    name: "Diagonal hev",
    category: "Rehab",
    group: "Skulder",
    equipment: "Strikk",
    level: "Nybegynner",
    description: "",
  },
];

describe("Laila-style program open path", () => {
  it("can expand Helkropp + rehab exercise without crashing", () => {
    const program: TrainingProgram = {
      id: "helkropp",
      memberId: "member-4k47wxi",
      title: "Helkropp",
      goal: "",
      notes: "",
      createdAt: "2026-05-21",
      exercises: normalizeProgramExercises([
        {
          id: "draft-ex-4o63bjx",
          exerciseId: "e5",
          exerciseName: "Beinpress",
          sets: "3",
          reps: "12",
          weight: "30",
          restSeconds: "90",
          notes: "",
        },
        {
          id: "prog-ex-diag",
          exerciseId: "ex-oat0pr0",
          exerciseName: "Diagonal hev",
          sets: "3",
          reps: "10",
          // missing weight/rest like production edge cases
        },
      ]),
    };

    const categoryById = new Map(exercises.map((exercise) => [exercise.id, exercise.category]));
    expect(isMemberIntervalWorkoutProgram(program, categoryById, exercises)).toBe(false);
    expect(getTrainingProgramSubTab(program, categoryById, exercises)).toBe("strength");

    const results = expandProgramExercisesToWorkoutResults(program.exercises, exercises, { program });
    expect(results.length).toBeGreaterThan(0);
    const groups = buildWorkoutResultGroups(results, program);
    expect(groups.length).toBe(2);
    expect(groups[0]?.exerciseName).toBe("Beinpress");
    expect(groups[1]?.exerciseName).toBe("Diagonal hev");
  });
});
