import { useEffect, useState } from "react";
import { MOTUS } from "../app/data";
import { motusHaptic } from "../app/haptics";
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

  function handleToggle() {
    motusHaptic("medium");
    if (running) handleStop();
    else handleStart();
  }

  return (
    <div
      className="relative mb-2 overflow-hidden rounded-lg border bg-teal-50 px-2.5 py-1.5 sm:mb-3 sm:rounded-xl sm:px-3 sm:py-2"
      style={{ borderColor: "rgba(48,227,190,0.25)" }}
      aria-live="polite"
      aria-label={`Stoppeklokke ${display}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-teal-700 sm:text-xs">
            Stoppeklokke
          </span>
          <p className="min-w-0 tabular-nums text-[1.85rem] font-black leading-none tracking-tight text-slate-900 sm:text-[2.5rem]">
            {display}
          </p>
        </div>
        <button
          type="button"
          onClick={handleToggle}
          className="motus-pressable inline-flex min-h-12 min-w-[6.5rem] shrink-0 items-center justify-center rounded-xl px-5 text-sm font-bold text-white shadow-sm transition hover:opacity-95 sm:min-h-[3.25rem] sm:min-w-[7.5rem] sm:text-base"
          style={{ background: running ? MOTUS.pink : MOTUS.turquoise }}
        >
          {running ? "Stopp" : "Start"}
        </button>
      </div>
    </div>
  );
}
