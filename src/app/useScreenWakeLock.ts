import { useEffect, useRef } from "react";

type WakeLockNavigator = Navigator & {
  wakeLock?: {
    request(type: "screen"): Promise<WakeLockSentinel>;
  };
};

/** Keep the device screen on while `active` (e.g. live workout, interval timer). */
export function useScreenWakeLock(active: boolean): void {
  const sentinelRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!active) return undefined;

    let cancelled = false;

    async function release() {
      const sentinel = sentinelRef.current;
      sentinelRef.current = null;
      if (!sentinel) return;
      try {
        await sentinel.release();
      } catch {
        // Already released when tab is hidden.
      }
    }

    async function acquire() {
      if (cancelled) return;
      const nav = navigator as WakeLockNavigator;
      if (!nav.wakeLock?.request) return;
      if (sentinelRef.current) return;
      try {
        const sentinel = await nav.wakeLock.request("screen");
        if (cancelled) {
          await sentinel.release();
          return;
        }
        sentinelRef.current = sentinel;
        sentinel.addEventListener("release", () => {
          if (sentinelRef.current === sentinel) {
            sentinelRef.current = null;
          }
        });
      } catch {
        // May require a user gesture on some browsers until first interaction.
      }
    }

    void acquire();

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void acquire();
      }
    };

    const onPointerDown = () => {
      if (!sentinelRef.current) {
        void acquire();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    document.addEventListener("pointerdown", onPointerDown, { capture: true, passive: true });

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      document.removeEventListener("pointerdown", onPointerDown, { capture: true });
      void release();
    };
  }, [active]);
}
