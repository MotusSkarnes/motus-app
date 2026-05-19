import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PAUSED_WORKOUTS_STORAGE_KEY,
  PAUSED_WORKOUT_TTL_MS,
  formatPausedWorkoutExpiry,
  listPausedWorkouts,
  pausedWorkoutProgress,
  purgeExpiredPausedWorkouts,
  removePausedWorkout,
  upsertPausedWorkout,
} from "./pausedWorkoutStorage";
import type { WorkoutModeState } from "./types";

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
      plannedWeight: "60",
      plannedReps: "8",
      performedWeight: "60",
      performedReps: "8",
      completed: true,
    },
    {
      exerciseId: "e1-set-2",
      programExerciseId: "pe1",
      exerciseName: "Knebøy",
      setNumber: 2,
      plannedSets: "3",
      plannedWeight: "60",
      plannedReps: "8",
      performedWeight: "",
      performedReps: "",
      completed: false,
    },
  ],
};

describe("pausedWorkoutStorage", () => {
  afterEach(() => {
    window.localStorage.removeItem(PAUSED_WORKOUTS_STORAGE_KEY);
    vi.useRealTimers();
  });

  it("upserts and lists active drafts for a member", () => {
    const now = 1_700_000_000_000;
    vi.setSystemTime(now);
    upsertPausedWorkout({
      memberId: "m1",
      programId: "p1",
      programTitle: "Styrke A",
      workoutMode,
      nowMs: now,
    });

    const drafts = listPausedWorkouts("m1", now);
    expect(drafts).toHaveLength(1);
    expect(drafts[0]?.programTitle).toBe("Styrke A");
    expect(drafts[0]?.expiresAt).toBe(now + PAUSED_WORKOUT_TTL_MS);
  });

  it("purges expired drafts", () => {
    const now = 1_700_000_000_000;
    upsertPausedWorkout({
      memberId: "m1",
      programId: "p1",
      programTitle: "Gammel",
      workoutMode,
      nowMs: now - PAUSED_WORKOUT_TTL_MS - 1,
    });

    purgeExpiredPausedWorkouts(now);
    expect(listPausedWorkouts("m1", now)).toHaveLength(0);
  });

  it("removes a draft by id", () => {
    const draft = upsertPausedWorkout({
      memberId: "m1",
      programId: "p1",
      programTitle: "Styrke A",
      workoutMode,
    });
    removePausedWorkout("m1", draft.id);
    expect(listPausedWorkouts("m1")).toHaveLength(0);
  });

  it("reports workout progress", () => {
    expect(pausedWorkoutProgress(workoutMode)).toEqual({ completed: 1, total: 2 });
  });

  it("formats remaining time until expiry", () => {
    const now = 1_700_000_000_000;
    expect(formatPausedWorkoutExpiry(now + 90 * 60_000, now)).toBe("Utløper om 1 t 30 min");
    expect(formatPausedWorkoutExpiry(now + 25 * 60_000, now)).toBe("Utløper om 25 min");
  });
});
