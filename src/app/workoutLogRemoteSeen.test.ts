import { beforeEach, describe, expect, it } from "vitest";
import type { WorkoutLog } from "./types";
import {
  markWorkoutLogDeletedLocally,
  markWorkoutLogSeenInRemote,
  wasWorkoutLogSeenInRemote,
  workoutLogsRepresentSameSession,
} from "./workoutLogRemoteSeen";

describe("workoutLogRemoteSeen", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("matches same session by member, title and date", () => {
    const base: WorkoutLog = {
      id: "a",
      memberId: "m1",
      programTitle: "Aktivitet: Sykling",
      date: "02.06.2026",
      status: "Fullført",
      results: [],
    };
    expect(workoutLogsRepresentSameSession(base, { ...base, id: "b" })).toBe(true);
    expect(workoutLogsRepresentSameSession(base, { ...base, programTitle: "Aktivitet: Løp" })).toBe(false);
  });

  it("tracks ids seen in remote and deleted locally", () => {
    expect(wasWorkoutLogSeenInRemote("log-1")).toBe(false);
    markWorkoutLogSeenInRemote("log-1");
    expect(wasWorkoutLogSeenInRemote("log-1")).toBe(true);
    markWorkoutLogDeletedLocally("log-2");
    expect(wasWorkoutLogSeenInRemote("log-2")).toBe(true);
  });
});
