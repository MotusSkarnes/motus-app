import { describe, expect, it } from "vitest";
import { dismissWorkoutModeInState, resumePausedWorkoutInState } from "./pausedWorkoutSession";
import { listPausedWorkouts, PAUSED_WORKOUTS_STORAGE_KEY, upsertPausedWorkout } from "./pausedWorkoutStorage";
import type { AppState, WorkoutModeState } from "./types";

const workoutMode: WorkoutModeState = {
  programId: "p1",
  memberId: "m1",
  programTitle: "Styrke A",
  note: "",
  results: [
    {
      exerciseId: "e1-set-1",
      programExerciseId: "pe1",
      exerciseName: "Knebøy",
      setNumber: 1,
      plannedSets: "3",
      plannedReps: "8",
      plannedWeight: "60",
      performedWeight: "60",
      performedReps: "8",
      completed: true,
    },
  ],
};

function baseState(): AppState {
  return {
    workoutMode: null,
    workoutCelebration: null,
    members: [{ id: "m1", name: "Test", email: "t@t.no", isActive: true, invitedAt: "", phone: "", birthDate: "", weight: "", height: "", level: "Nybegynner", membershipType: "Basis", customerType: "Medlem", daysSinceActivity: "", goal: "", focus: "", personalGoals: "", injuries: "", coachNotes: "" }],
    exercises: [],
    programs: [
      {
        id: "p1",
        memberId: "m1",
        title: "Styrke A",
        goal: "",
        notes: "",
        createdAt: "01.01.2025",
        exercises: [],
      },
    ],
    logs: [],
    messages: [],
    currentUser: { id: "u1", role: "member", name: "Test", email: "t@t.no", memberId: "m1" },
    role: "member",
    selectedMemberId: "m1",
    memberViewId: "m1",
  };
}

describe("pausedWorkoutSession", () => {
  it("dismiss saves draft and clears active workout mode", () => {
    window.localStorage.removeItem(PAUSED_WORKOUTS_STORAGE_KEY);
    const state = { ...baseState(), workoutMode };
    const next = dismissWorkoutModeInState(state);
    expect(next.workoutMode).toBeNull();
    expect(listPausedWorkouts("m1")).toHaveLength(1);
    expect(listPausedWorkouts("m1")[0]?.programTitle).toBe("Styrke A");
  });

  it("dismiss saves draft when log-after fields have progress", () => {
    window.localStorage.removeItem(PAUSED_WORKOUTS_STORAGE_KEY);
    const logAfterWorkoutMode: WorkoutModeState = {
      ...workoutMode,
      note: "",
      results: [
        {
          ...workoutMode.results[0],
          performedWeight: "",
          performedReps: "",
          completed: false,
          performedDistanceKm: "5.0",
        },
      ],
    };
    const state = { ...baseState(), workoutMode: logAfterWorkoutMode };

    dismissWorkoutModeInState(state);

    expect(listPausedWorkouts("m1")).toHaveLength(1);
    expect(listPausedWorkouts("m1")[0]?.workoutMode.results[0]?.performedDistanceKm).toBe("5.0");
  });

  it("resume restores workout mode from draft", () => {
    window.localStorage.removeItem(PAUSED_WORKOUTS_STORAGE_KEY);
    const draft = upsertPausedWorkout({
      memberId: "m1",
      programId: "p1",
      programTitle: "Styrke A",
      workoutMode,
    });
    const next = resumePausedWorkoutInState(baseState(), draft.id, "m1");
    expect(next.workoutMode?.programId).toBe("p1");
    expect(next.workoutMode?.results[0]?.completed).toBe(true);
  });

  it("resume restores program into state when trainer program was removed after pause", () => {
    window.localStorage.removeItem(PAUSED_WORKOUTS_STORAGE_KEY);
    const programSnapshot = baseState().programs[0];
    const draft = upsertPausedWorkout({
      memberId: "m1",
      programId: "p1",
      programTitle: "Styrke A",
      workoutMode,
      programSnapshot,
    });
    const emptyPrograms = { ...baseState(), programs: [] };
    const next = resumePausedWorkoutInState(emptyPrograms, draft.id, "m1");
    expect(next.workoutMode?.programId).toBe("p1");
    expect(next.programs.some((program) => program.id === "p1")).toBe(true);
  });
});
