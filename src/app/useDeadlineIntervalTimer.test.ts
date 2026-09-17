import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDeadlineIntervalTimer } from "./useDeadlineIntervalTimer";

describe("useDeadlineIntervalTimer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-17T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps wall-clock time after a delayed tick", () => {
    const onAllStepsComplete = vi.fn();
    const { result } = renderHook(() =>
      useDeadlineIntervalTimer({
        steps: [{ durationSeconds: 20 }],
        isRunning: true,
        isPaused: false,
        onAllStepsComplete,
      }),
    );

    act(() => {
      result.current.start();
    });
    expect(result.current.remainingSeconds).toBe(20);

    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(result.current.remainingSeconds).toBe(20);

    act(() => {
      vi.setSystemTime(new Date("2026-09-17T12:00:03.000Z"));
      vi.advanceTimersByTime(250);
    });
    expect(result.current.remainingSeconds).toBe(17);
    expect(onAllStepsComplete).not.toHaveBeenCalled();
  });
});
