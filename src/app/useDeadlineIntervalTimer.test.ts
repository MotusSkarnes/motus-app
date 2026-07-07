import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDeadlineIntervalTimer } from "./useDeadlineIntervalTimer";

describe("useDeadlineIntervalTimer", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("continues ticking after pause and resume", () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const onAllStepsComplete = vi.fn();
    const { result, rerender } = renderHook(
      ({ isPaused }) =>
        useDeadlineIntervalTimer({
          steps: [{ durationSeconds: 5 }],
          isRunning: true,
          isPaused,
          onAllStepsComplete,
        }),
      { initialProps: { isPaused: false } },
    );

    act(() => {
      result.current.start();
    });
    act(() => {
      vi.advanceTimersByTime(2_100);
    });
    expect(result.current.remainingSeconds).toBe(3);

    rerender({ isPaused: true });
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(result.current.remainingSeconds).toBe(3);

    rerender({ isPaused: false });
    act(() => {
      vi.advanceTimersByTime(1_250);
    });
    expect(result.current.remainingSeconds).toBe(2);
  });
});
