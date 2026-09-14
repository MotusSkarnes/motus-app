import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { MOTUS } from "../app/data";
import { motusHaptic } from "../app/haptics";
import { formatHoldStopwatch, holdStopwatchLoggedSeconds } from "../app/workoutHoldStopwatch";

type WorkoutHoldStopwatchProps = {
  onStopWithSeconds?: (seconds: number) => void;
};

function paintHoldStopwatch(elapsedMs: number, displayEl: HTMLElement | null, rootEl: HTMLElement | null) {
  const next = formatHoldStopwatch(elapsedMs);
  if (displayEl && displayEl.textContent !== next) displayEl.textContent = next;
  if (rootEl) {
    const label = `Stoppeklokke ${next}`;
    if (rootEl.getAttribute("aria-label") !== label) rootEl.setAttribute("aria-label", label);
  }
}

export function WorkoutHoldStopwatch({ onStopWithSeconds }: WorkoutHoldStopwatchProps) {
  const [running, setRunning] = useState(false);
  const [stoppedDisplay, setStoppedDisplay] = useState(() => formatHoldStopwatch(0));
  const startedAtMsRef = useRef<number | null>(null);
  const displayRef = useRef<HTMLParagraphElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const onStopRef = useRef(onStopWithSeconds);
  onStopRef.current = onStopWithSeconds;

  function elapsedNow() {
    const startedAt = startedAtMsRef.current;
    return startedAt != null ? Math.max(0, Date.now() - startedAt) : 0;
  }

  function paint(elapsedMs: number) {
    paintHoldStopwatch(elapsedMs, displayRef.current, rootRef.current);
  }

  useLayoutEffect(() => {
    if (!running) return;
    paint(elapsedNow());
    // Re-paint after parent commits so a heavy workout re-render cannot flash a stale 0:00.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  });

  useEffect(() => {
    if (!running) return;
    let frameId = 0;
    const tick = () => {
      paint(elapsedNow());
      frameId = window.requestAnimationFrame(tick);
    };
    frameId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frameId);
  }, [running]);

  function handleStart() {
    if (running) return;
    startedAtMsRef.current = Date.now();
    paint(0);
    setRunning(true);
  }

  function handleStop() {
    if (!running || startedAtMsRef.current == null) return;
    const nextElapsed = elapsedNow();
    startedAtMsRef.current = null;
    const display = formatHoldStopwatch(nextElapsed);
    setStoppedDisplay(display);
    setRunning(false);
    paint(nextElapsed);
    const seconds = holdStopwatchLoggedSeconds(nextElapsed);
    if (seconds > 0) onStopRef.current?.(seconds);
  }

  function handleToggle() {
    motusHaptic("medium");
    if (running) handleStop();
    else handleStart();
  }

  return (
    <div
      ref={rootRef}
      className="relative mb-2 overflow-hidden rounded-lg border bg-teal-50 px-2.5 py-1.5 sm:mb-3 sm:rounded-xl sm:px-3 sm:py-2"
      style={{ borderColor: "rgba(48,227,190,0.25)" }}
      aria-label={`Stoppeklokke ${stoppedDisplay}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-teal-700 sm:text-xs">
            Stoppeklokke
          </span>
          <p
            ref={displayRef}
            className="min-w-0 tabular-nums text-[1.85rem] font-black leading-none tracking-tight text-slate-900 sm:text-[2.5rem]"
          >
            {stoppedDisplay}
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
