import { describe, expect, it } from "vitest";
import type { AppState } from "../app/types";
import { finishWorkoutModeInState, removeWorkoutLogResultInState } from "./appRepository";

function createBaseState(): AppState {
  return {
    workoutMode: null,
    workoutCelebration: null,
    members: [],
    exercises: [],
    programs: [
      {
        id: "program-1",
        memberId: "member-1",
        title: "Styrke A",
        goal: "",
        notes: "",
        createdAt: "24.04.2026",
        exercises: [],
      },
    ],
    logs: [],
    messages: [],
    currentUser: null,
    role: "trainer",
    selectedMemberId: "member-1",
    memberViewId: "member-1",
  };
}

describe("appRepository workout log guards", () => {
  it("deduplicates duplicate set rows when finishing workout", () => {
    const state = createBaseState();
    state.workoutMode = {
      programId: "program-1",
      note: "Bra økt",
      results: [
        {
          exerciseId: "prog-ex-1-set-1",
          programExerciseId: "prog-ex-1",
          setNumber: 1,
          exerciseName: "Knebøy",
          plannedSets: "3",
          plannedReps: "8",
          plannedWeight: "60",
          performedWeight: "60",
          performedReps: "8",
          completed: true,
        },
        {
          exerciseId: "prog-ex-1-set-1-duplicate",
          programExerciseId: "prog-ex-1",
          setNumber: 1,
          exerciseName: "Knebøy",
          plannedSets: "3",
          plannedReps: "8",
          plannedWeight: "60",
          performedWeight: "60",
          performedReps: "8",
          completed: true,
        },
      ],
    };

    const next = finishWorkoutModeInState(state);
    expect(next.logs).toHaveLength(1);
    expect(next.logs[0].results).toHaveLength(1);
  });

  it("removes a single logged exercise from an existing log", () => {
    const state = createBaseState();
    state.logs = [
      {
        id: "log-1",
        memberId: "member-1",
        programTitle: "Styrke A",
        date: "24.04.2026",
        status: "Fullført",
        note: "",
        results: [
          {
            exerciseId: "set-1",
            programExerciseId: "prog-ex-1",
            setNumber: 1,
            exerciseName: "Knebøy",
            plannedSets: "3",
            plannedReps: "8",
            plannedWeight: "60",
            performedWeight: "60",
            performedReps: "8",
            completed: true,
          },
          {
            exerciseId: "set-2",
            programExerciseId: "prog-ex-1",
            setNumber: 2,
            exerciseName: "Knebøy",
            plannedSets: "3",
            plannedReps: "8",
            plannedWeight: "60",
            performedWeight: "62.5",
            performedReps: "6",
            completed: true,
          },
        ],
      },
    ];

    const next = removeWorkoutLogResultInState(state, { logId: "log-1", exerciseId: "set-2" });
    expect(next.logs[0].results).toHaveLength(1);
    expect(next.logs[0].results?.[0].exerciseId).toBe("set-1");
  });
});
