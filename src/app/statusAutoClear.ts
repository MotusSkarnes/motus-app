import { useEffect, useRef } from "react";

export function useAutoClearStatus(status: string | null, clearStatus: () => void, delayMs = 3000): void {
  const clearRef = useRef(clearStatus);
  clearRef.current = clearStatus;
  useEffect(() => {
    if (!status) return;
    const timerId = window.setTimeout(() => {
      clearRef.current();
    }, delayMs);
    return () => window.clearTimeout(timerId);
  }, [status, delayMs]);
}

export function getStatusClearDelayMs(status: string | null): number {
  const value = String(status ?? "").trim().toLowerCase();
  if (!value) return 3000;
  if (value.includes("feil") || value.includes("feilet") || value.includes("kunne ikke")) return 8000;
  return 3000;
}
