import { describe, expect, it } from "vitest";
import { remainingSecondsUntilDeadline, syncIntervalTimerFromDeadline } from "./intervalTimerDeadline";

describe("intervalTimerDeadline", () => {
  const steps = [{ durationSeconds: 30 }, { durationSeconds: 60 }, { durationSeconds: 15 }];

  it("counts down to the next second boundary", () => {
    const endsAt = 10_000;
    expect(remainingSecondsUntilDeadline(endsAt, 6_500)).toBe(4);
    expect(remainingSecondsUntilDeadline(endsAt, 9_999)).toBe(1);
    expect(remainingSecondsUntilDeadline(endsAt, 10_000)).toBe(0);
  });

  it("advances through skipped time while the app was in the background", () => {
    const start = 1_000;
    const firstEndsAt = start + 30_000;
    const synced = syncIntervalTimerFromDeadline(steps, 0, firstEndsAt, start + 95_000);
    expect(synced.allComplete).toBe(false);
    expect(synced.stepIndex).toBe(2);
    expect(synced.remainingSeconds).toBe(10);
  });

  it("marks the session complete after the final step", () => {
    const start = 5_000;
    const finalEndsAt = start + 15_000;
    const synced = syncIntervalTimerFromDeadline(steps, 2, finalEndsAt, finalEndsAt);
    expect(synced.allComplete).toBe(true);
    expect(synced.remainingSeconds).toBe(0);
  });
});
