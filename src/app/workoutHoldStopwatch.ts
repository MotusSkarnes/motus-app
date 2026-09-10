/** Display elapsed hold time as m:ss.cc (minutes, seconds, hundredths). */
export function formatHoldStopwatch(elapsedMs: number): string {
  const clamped = Math.max(0, Math.floor(elapsedMs));
  const hundredths = Math.floor(clamped / 10) % 100;
  const totalSeconds = Math.floor(clamped / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}.${String(hundredths).padStart(2, "0")}`;
}

/** Whole seconds to log after a hold, rounded from the stopwatch. */
export function holdStopwatchLoggedSeconds(elapsedMs: number): number {
  return Math.max(0, Math.round(elapsedMs / 1000));
}
