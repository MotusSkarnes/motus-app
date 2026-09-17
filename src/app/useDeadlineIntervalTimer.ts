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
  const [clockNonce, setClockNonce] = useState(0);
  const stepEndsAtMsRef = useRef<number | null>(null);
  const stepIndexRef = useRef(0);
  const remainingSecondsRef = useRef(0);
  const stepsRef = useRef(steps);
  const onCompleteRef = useRef(onAllStepsComplete);
  const completedRef = useRef(false);

  useEffect(() => {
    onCompleteRef.current = onAllStepsComplete;
  }, [onAllStepsComplete]);

  useEffect(() => {
    stepsRef.current = steps;
  }, [steps]);

  const applySync = useCallback((nowMs: number = Date.now()) => {
    const endsAt = stepEndsAtMsRef.current;
    if (endsAt == null) return;
    const synced = syncIntervalTimerFromDeadline(stepsRef.current, stepIndexRef.current, endsAt, nowMs);
    stepEndsAtMsRef.current = synced.stepEndsAtMs;
    if (stepIndexRef.current !== synced.stepIndex) {
      stepIndexRef.current = synced.stepIndex;
      setStepIndex(synced.stepIndex);
    }
    if (remainingSecondsRef.current !== synced.remainingSeconds) {
      remainingSecondsRef.current = synced.remainingSeconds;
      setRemainingSeconds(synced.remainingSeconds);
    }
    if (synced.allComplete && !completedRef.current) {
      completedRef.current = true;
      stepEndsAtMsRef.current = null;
      onCompleteRef.current();
    }
  }, []);

  const armDeadline = useCallback((index: number, durationSeconds: number, nowMs: number = Date.now()) => {
    const currentSteps = stepsRef.current;
    const safeIndex = Math.min(Math.max(0, index), Math.max(0, currentSteps.length - 1));
    const durationMs = Math.max(0, durationSeconds) * 1000;
    completedRef.current = false;
    stepEndsAtMsRef.current = nowMs + durationMs;
    stepIndexRef.current = safeIndex;
    const remaining = remainingSecondsUntilDeadline(stepEndsAtMsRef.current, nowMs);
    remainingSecondsRef.current = remaining;
    setStepIndex(safeIndex);
    setRemainingSeconds(remaining);
    setClockNonce((nonce) => nonce + 1);
  }, []);

  const clearDeadline = useCallback(() => {
    stepEndsAtMsRef.current = null;
  }, []);

  const resetToStep = useCallback(
    (index = 0) => {
      clearDeadline();
      completedRef.current = false;
      const currentSteps = stepsRef.current;
      const safeIndex = Math.min(Math.max(0, index), Math.max(0, currentSteps.length - 1));
      const duration = currentSteps[safeIndex]?.durationSeconds ?? 0;
      stepIndexRef.current = safeIndex;
      remainingSecondsRef.current = duration;
      setStepIndex(safeIndex);
      setRemainingSeconds(duration);
    },
    [clearDeadline],
  );

  const start = useCallback(() => {
    if (!stepsRef.current.length) return;
    resetToStep(0);
    armDeadline(0, stepsRef.current[0].durationSeconds);
  }, [armDeadline, resetToStep]);

  const skipToNext = useCallback(() => {
    const currentSteps = stepsRef.current;
    if (!currentSteps.length) return null;
    const nextIndex = stepIndexRef.current + 1;
    const nextStep = currentSteps[nextIndex];
    if (!nextStep) {
      remainingSecondsRef.current = 0;
      setRemainingSeconds(0);
      clearDeadline();
      if (!completedRef.current) {
        completedRef.current = true;
        onCompleteRef.current();
      }
      return null;
    }
    armDeadline(nextIndex, nextStep.durationSeconds);
    return nextStep;
  }, [armDeadline, clearDeadline]);

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
  }, [applySync, clockNonce, isPaused, isRunning]);

  useEffect(() => {
    if (!isRunning || !isPaused || stepEndsAtMsRef.current == null) return;
    const endsAt = stepEndsAtMsRef.current;
    const remaining = remainingSecondsUntilDeadline(endsAt, Date.now());
    stepEndsAtMsRef.current = null;
    remainingSecondsRef.current = remaining;
    setRemainingSeconds(remaining);
  }, [isPaused, isRunning]);

  useEffect(() => {
    if (!isRunning || isPaused || stepEndsAtMsRef.current != null) return;
    if (remainingSecondsRef.current <= 0) return;
    armDeadline(stepIndexRef.current, remainingSecondsRef.current);
  }, [armDeadline, isPaused, isRunning]);

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
