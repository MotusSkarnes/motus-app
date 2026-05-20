import { useCallback, useEffect, useRef, useState } from "react";
import { remainingSecondsUntilDeadline, syncIntervalTimerFromDeadline, type IntervalTimerDeadlineStep } from "./intervalTimerDeadline";

const TICK_MS = 250;

export type UseDeadlineIntervalTimerOptions<T extends IntervalTimerDeadlineStep> = {
  steps: T[];
  isRunning: boolean;
  isPaused: boolean;
  onAllStepsComplete: () => void;
};

export function useDeadlineIntervalTimer<T extends IntervalTimerDeadlineStep>({
  steps,
  isRunning,
  isPaused,
  onAllStepsComplete,
}: UseDeadlineIntervalTimerOptions<T>) {
  const [stepIndex, setStepIndex] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const stepEndsAtMsRef = useRef<number | null>(null);
  const onCompleteRef = useRef(onAllStepsComplete);
  onCompleteRef.current = onAllStepsComplete;

  const applySync = useCallback(
    (nowMs: number = Date.now()) => {
      const endsAt = stepEndsAtMsRef.current;
      if (endsAt == null) return;
      const synced = syncIntervalTimerFromDeadline(steps, stepIndex, endsAt, nowMs);
      stepEndsAtMsRef.current = synced.stepEndsAtMs;
      setStepIndex(synced.stepIndex);
      setRemainingSeconds(synced.remainingSeconds);
      if (synced.allComplete) {
        stepEndsAtMsRef.current = null;
        onCompleteRef.current();
      }
    },
    [stepIndex, steps],
  );

  const armDeadline = useCallback(
    (index: number, durationSeconds: number, nowMs: number = Date.now()) => {
      const safeIndex = Math.min(Math.max(0, index), Math.max(0, steps.length - 1));
      const durationMs = Math.max(0, durationSeconds) * 1000;
      stepEndsAtMsRef.current = nowMs + durationMs;
      setStepIndex(safeIndex);
      setRemainingSeconds(remainingSecondsUntilDeadline(stepEndsAtMsRef.current, nowMs));
    },
    [steps.length],
  );

  const clearDeadline = useCallback(() => {
    stepEndsAtMsRef.current = null;
  }, []);

  const resetToStep = useCallback(
    (index = 0) => {
      clearDeadline();
      const safeIndex = Math.min(Math.max(0, index), Math.max(0, steps.length - 1));
      const duration = steps[safeIndex]?.durationSeconds ?? 0;
      setStepIndex(safeIndex);
      setRemainingSeconds(duration);
    },
    [clearDeadline, steps],
  );

  const start = useCallback(() => {
    if (!steps.length) return;
    resetToStep(0);
    armDeadline(0, steps[0].durationSeconds);
  }, [armDeadline, resetToStep, steps]);

  const skipToNext = useCallback(() => {
    if (!steps.length) return null;
    const nextIndex = stepIndex + 1;
    const nextStep = steps[nextIndex];
    if (!nextStep) {
      setRemainingSeconds(0);
      clearDeadline();
      onCompleteRef.current();
      return null;
    }
    armDeadline(nextIndex, nextStep.durationSeconds);
    return nextStep;
  }, [armDeadline, clearDeadline, stepIndex, steps]);

  useEffect(() => {
    if (!isRunning || isPaused || stepEndsAtMsRef.current == null) return;

    applySync();
    const intervalId = window.setInterval(() => applySync(), TICK_MS);

    const onVisibilityOrFocus = () => applySync();
    document.addEventListener("visibilitychange", onVisibilityOrFocus);
    window.addEventListener("focus", onVisibilityOrFocus);
    window.addEventListener("pageshow", onVisibilityOrFocus);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibilityOrFocus);
      window.removeEventListener("focus", onVisibilityOrFocus);
      window.removeEventListener("pageshow", onVisibilityOrFocus);
    };
  }, [applySync, isPaused, isRunning]);

  useEffect(() => {
    if (!isRunning || !isPaused || stepEndsAtMsRef.current == null) return;
    const endsAt = stepEndsAtMsRef.current;
    const remaining = remainingSecondsUntilDeadline(endsAt, Date.now());
    stepEndsAtMsRef.current = null;
    setRemainingSeconds(remaining);
  }, [isPaused, isRunning]);

  useEffect(() => {
    if (!isRunning || isPaused || stepEndsAtMsRef.current != null) return;
    if (remainingSeconds <= 0) return;
    armDeadline(stepIndex, remainingSeconds);
  }, [armDeadline, isPaused, isRunning, remainingSeconds, stepIndex]);

  return {
    stepIndex,
    remainingSeconds,
    setStepIndex,
    setRemainingSeconds,
    resetToStep,
    start,
    skipToNext,
    clearDeadline,
    armDeadline,
  };
}
