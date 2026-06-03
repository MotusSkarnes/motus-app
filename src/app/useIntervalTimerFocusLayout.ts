import { useEffect, useState } from "react";

/** True when viewport is wide-and-short (typical phone in landscape). */
export function resolveIntervalTimerFocusLayout(): boolean {
  if (typeof window === "undefined") return false;
  const width = window.innerWidth;
  const height = window.innerHeight;
  return width > height && height <= 720;
}

export function useIntervalTimerFocusLayout(active: boolean, manualFocus: boolean): boolean {
  const [autoFocus, setAutoFocus] = useState(() => active && resolveIntervalTimerFocusLayout());

  useEffect(() => {
    if (!active) {
      setAutoFocus(false);
      return;
    }
    const update = () => setAutoFocus(resolveIntervalTimerFocusLayout());
    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, [active]);

  return autoFocus || manualFocus;
}
