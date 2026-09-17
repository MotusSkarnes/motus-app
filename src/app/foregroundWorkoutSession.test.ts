import { describe, expect, it, vi } from "vitest";
import {
  beginForegroundWorkoutSession,
  isForegroundWorkoutSessionActive,
  onForegroundWorkoutSessionIdle,
  resetForegroundWorkoutSessionForTests,
} from "./foregroundWorkoutSession";

describe("foregroundWorkoutSession", () => {
  it("tracks nested interval sessions", () => {
    resetForegroundWorkoutSessionForTests();
    expect(isForegroundWorkoutSessionActive()).toBe(false);
    const endFirst = beginForegroundWorkoutSession();
    const endSecond = beginForegroundWorkoutSession();
    expect(isForegroundWorkoutSessionActive()).toBe(true);
    endFirst();
    expect(isForegroundWorkoutSessionActive()).toBe(true);
    endSecond();
    expect(isForegroundWorkoutSessionActive()).toBe(false);
  });

  it("notifies when the last session ends", () => {
    resetForegroundWorkoutSessionForTests();
    const idle = vi.fn();
    const stop = onForegroundWorkoutSessionIdle(idle);
    const end = beginForegroundWorkoutSession();
    expect(idle).not.toHaveBeenCalled();
    end();
    expect(idle).toHaveBeenCalledTimes(1);
    stop();
  });
});
