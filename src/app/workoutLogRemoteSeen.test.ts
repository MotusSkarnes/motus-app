import { beforeEach, describe, expect, it } from "vitest";
import {
  markWorkoutLogDeletedLocally,
  markWorkoutLogSeenInRemote,
  wasWorkoutLogSeenInRemote,
} from "./workoutLogRemoteSeen";

describe("workoutLogRemoteSeen", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("tracks ids seen in remote and deleted locally", () => {
    expect(wasWorkoutLogSeenInRemote("log-1")).toBe(false);
    markWorkoutLogSeenInRemote("log-1");
    expect(wasWorkoutLogSeenInRemote("log-1")).toBe(true);
    markWorkoutLogDeletedLocally("log-2");
    expect(wasWorkoutLogSeenInRemote("log-2")).toBe(true);
  });
});
