export type MotusHapticKind = "light" | "medium" | "success" | "selection";

const HAPTIC_PATTERNS: Record<MotusHapticKind, number | number[]> = {
  light: 8,
  medium: 16,
  success: [12, 40, 12],
  selection: 6,
};

/** Best-effort haptic feedback (Vibration API). No-op when unsupported. */
export function motusHaptic(kind: MotusHapticKind = "light"): void {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  try {
    navigator.vibrate(HAPTIC_PATTERNS[kind]);
  } catch {
    // ignore — some browsers block vibration outside user gestures
  }
}
