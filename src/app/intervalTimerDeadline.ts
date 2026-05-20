export type IntervalTimerDeadlineStep = {
  durationSeconds: number;
};

export function remainingSecondsUntilDeadline(deadlineMs: number, nowMs: number): number {
  return Math.max(0, Math.ceil((deadlineMs - nowMs) / 1000));
}

/** Advance through steps when wall-clock time has passed one or more step deadlines. */
export function syncIntervalTimerFromDeadline<T extends IntervalTimerDeadlineStep>(
  steps: T[],
  stepIndex: number,
  stepEndsAtMs: number,
  nowMs: number,
): {
  stepIndex: number;
  stepEndsAtMs: number;
  remainingSeconds: number;
  allComplete: boolean;
} {
  if (!steps.length) {
    return { stepIndex: 0, stepEndsAtMs: stepEndsAtMs, remainingSeconds: 0, allComplete: true };
  }

  let index = Math.min(Math.max(0, stepIndex), steps.length - 1);
  let endsAt = stepEndsAtMs;

  while (nowMs >= endsAt) {
    index += 1;
    if (index >= steps.length) {
      return { stepIndex: index, stepEndsAtMs: endsAt, remainingSeconds: 0, allComplete: true };
    }
    endsAt += steps[index].durationSeconds * 1000;
  }

  return {
    stepIndex: index,
    stepEndsAtMs: endsAt,
    remainingSeconds: remainingSecondsUntilDeadline(endsAt, nowMs),
    allComplete: false,
  };
}
