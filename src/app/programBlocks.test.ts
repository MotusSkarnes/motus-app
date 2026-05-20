import { describe, expect, it } from "vitest";
import {
  buildWorkoutResultGroups,
  expandProgramExercisesToWorkoutResults,
  isLegacyIntervalCooldownDrag,
  linkProgramExercisesAsBlock,
  mergeTrainingProgramDuplicates,
  normalizeLegacyIntervalCooldownExerciseNames,
  pickRestrictiveMemberLibraryStatus,
  splitProgramExercisesIntoSegments,
  workoutResultGroupId,
} from "./programBlocks";
import type { Exercise, ProgramExercise, TrainingProgram } from "./types";

const bank: Exercise[] = [
  {
    id: "ex-a",
    name: "Knebøy",
    category: "Styrke",
    group: "Bein",
    equipment: "Stang",
    level: "Litt øvet",
    description: "",
  },
  {
    id: "ex-b",
    name: "Utfall",
    category: "Styrke",
    group: "Bein",
    equipment: "Kroppsvekt",
    level: "Litt øvet",
    description: "",
  },
  {
    id: "ex-c",
    name: "Planke",
    category: "Styrke",
    group: "Core",
    equipment: "Kroppsvekt",
    level: "Litt øvet",
    description: "",
  },
];

function line(id: string, name: string, sets: string, block?: Partial<ProgramExercise>): ProgramExercise {
  return {
    id,
    exerciseId: `ex-${id}`,
    exerciseName: name,
    sets,
    reps: "10",
    weight: "40",
    restSeconds: "60",
    notes: "",
    ...block,
  };
}

describe("programBlocks", () => {
  it("expands superset interleaved by round", () => {
    const exercises = linkProgramExercisesAsBlock(
      [line("a", "Knebøy", "2"), line("b", "Utfall", "2")],
      0,
      2,
      "superset",
    );
    const results = expandProgramExercisesToWorkoutResults(exercises, bank);
    expect(results.map((r) => `${r.exerciseName}-r${r.blockRound}`)).toEqual([
      "Knebøy-r1",
      "Utfall-r1",
      "Knebøy-r2",
      "Utfall-r2",
    ]);
    expect(new Set(results.map((r) => r.blockId)).size).toBe(1);
  });

  it("groups workout results by blockId in øktmodus", () => {
    const exercises = linkProgramExercisesAsBlock(
      [line("a", "Knebøy", "2"), line("b", "Utfall", "2"), line("c", "Planke", "1")],
      0,
      2,
      "superset",
    );
    const results = expandProgramExercisesToWorkoutResults(exercises, bank);
    const groups = buildWorkoutResultGroups(results);
    expect(groups).toHaveLength(2);
    expect(groups[0]?.blockType).toBe("superset");
    expect(groups[0]?.exerciseNames).toEqual(["Knebøy", "Utfall"]);
    expect(groups[0]?.rounds).toHaveLength(2);
    expect(groups[1]?.exerciseName).toBe("Planke");
  });

  it("treats last mislabeled drag row as nedjogg when previous row is drag", () => {
    const exercises = [
      {
        id: "w",
        exerciseId: "ex1",
        exerciseName: "Oppvarming",
        sets: "1",
        reps: "",
        weight: "",
        durationMinutes: "10",
        speed: "7",
        restSeconds: "0",
        notes: "",
      },
      {
        id: "d1",
        exerciseId: "ex1",
        exerciseName: "Drag 1",
        sets: "1",
        reps: "",
        weight: "",
        durationMinutes: "4",
        speed: "13",
        restSeconds: "180",
        notes: "",
      },
      {
        id: "d4",
        exerciseId: "ex1",
        exerciseName: "Drag 4",
        sets: "1",
        reps: "",
        weight: "",
        durationMinutes: "5",
        speed: "13",
        restSeconds: "0",
        notes: "",
        targetHrPercent: "85–92",
      },
    ];
    expect(isLegacyIntervalCooldownDrag(exercises, 2)).toBe(true);
    const normalized = normalizeLegacyIntervalCooldownExerciseNames(exercises);
    expect(normalized[2]?.exerciseName).toBe("Nedjogg");
  });

  it("keeps hidden status when deduping duplicate program rows", () => {
    const base = {
      title: "Intervall",
      goal: "",
      notes: "",
      exercises: [line("a", "Drag 1", "1")],
    };
    const visible: TrainingProgram = { id: "p-new", memberId: "m1", createdAt: "02.01.2026", ...base };
    const hidden: TrainingProgram = {
      id: "p-old",
      memberId: "m1",
      createdAt: "01.01.2026",
      memberLibraryStatus: "hidden",
      ...base,
    };
    const merged = mergeTrainingProgramDuplicates(hidden, visible);
    expect(merged.memberLibraryStatus).toBe("archived");
    expect(pickRestrictiveMemberLibraryStatus(undefined, "hidden")).toBe("archived");
  });

  it("does not treat last work drag as nedjogg when it still has rest after", () => {
    const exercises = [
      {
        id: "d1",
        exerciseId: "ex1",
        exerciseName: "Drag 1",
        sets: "1",
        reps: "",
        weight: "",
        durationMinutes: "4",
        speed: "13",
        restSeconds: "180",
        notes: "",
      },
      {
        id: "d2",
        exerciseId: "ex1",
        exerciseName: "Drag 2",
        sets: "1",
        reps: "",
        weight: "",
        durationMinutes: "4",
        speed: "13",
        restSeconds: "120",
        notes: "",
      },
    ];
    expect(isLegacyIntervalCooldownDrag(exercises, 1)).toBe(false);
  });

  it("splits program into block and single segments", () => {
    const exercises = linkProgramExercisesAsBlock(
      [line("a", "A", "3"), line("b", "B", "3"), line("c", "C", "3")],
      0,
      3,
      "triset",
    );
    const segments = splitProgramExercisesIntoSegments(exercises);
    expect(segments).toHaveLength(1);
    expect(segments[0]).toHaveLength(3);
    expect(workoutResultGroupId({ exerciseId: "x", blockId: "blk", exerciseName: "A", plannedSets: "1", plannedReps: "1", plannedWeight: "1", performedWeight: "1", performedReps: "1", completed: false })).toBe("blk");
  });
});
