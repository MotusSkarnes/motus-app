import { useEffect, useState } from "react";
import { formatHoldStopwatch, holdStopwatchLoggedSeconds } from "../app/workoutHoldStopwatch";

type WorkoutHoldStopwatchProps = {
  onStopWithSeconds?: (seconds: number) => void;
};

export function WorkoutHoldStopwatch({ onStopWithSeconds }: WorkoutHoldStopwatchProps) {
  const [running, setRunning] = useState(false);
  const [startedAtMs, setStartedAtMs] = useState<number | null>(null);
  const [baseElapsedMs, setBaseElapsedMs] = useState(0);
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!running) return;
    const intervalId = window.setInterval(() => {
      setTick((tick) => tick + 1);
    }, 32);
    return () => window.clearInterval(intervalId);
  }, [running]);

  const elapsedMs = running && startedAtMs != null ? Date.now() - startedAtMs : baseElapsedMs;
  const display = formatHoldStopwatch(elapsedMs);

  function handleStart() {
    if (running) return;
    setBaseElapsedMs(0);
    setStartedAtMs(Date.now());
    setRunning(true);
  }

  function handleStop() {
    if (!running || startedAtMs == null) return;
    const nextElapsed = Math.max(0, Date.now() - startedAtMs);
    setRunning(false);
    setStartedAtMs(null);
    setBaseElapsedMs(nextElapsed);
    const seconds = holdStopwatchLoggedSeconds(nextElapsed);
    if (seconds > 0) onStopWithSeconds?.(seconds);
  }

  return (
    <div
      className="relative mb-2 overflow-hidden rounded-lg border bg-teal-50 px-2.5 py-1.5 sm:mb-3 sm:rounded-xl sm:px-3 sm:py-2"
      style={{ borderColor: "rgba(48,227,190,0.25)" }}
      aria-live="polite"
      aria-label={`Stoppeklokke ${display}`}
    >
      <div className="flex items-center justify-between gap-2 sm:gap-3">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-teal-700 sm:text-xs">
            Stoppeklokke
          </span>
          <p className="min-w-0 tabular-nums text-[1.85rem] font-black leading-none tracking-tight text-slate-900 sm:text-[2.5rem]">
            {display}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={handleStart}
            disabled={running}
            className="rounded-lg border bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-default disabled:opacity-40 sm:px-3 sm:py-2 sm:text-xs"
            style={{ borderColor: "rgba(15,23,42,0.08)" }}
          >
            Start
          </button>
          <button
            type="button"
            onClick={handleStop}
            disabled={!running}
            className="rounded-lg border bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-default disabled:opacity-40 sm:px-3 sm:py-2 sm:text-xs"
            style={{ borderColor: "rgba(15,23,42,0.08)" }}
          >
            Stopp
          </button>
        </div>
      </div>
    </div>
  );
}
