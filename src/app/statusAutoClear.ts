import { useEffect } from "react";

export function useAutoClearStatus(status: string | null, clearStatus: () => void, delayMs = 3000): void {
  useEffect(() => {
    if (!status) return;
    const timerId = window.setTimeout(() => {
      clearStatus();
    }, delayMs);
    return () => window.clearTimeout(timerId);
  }, [status, clearStatus, delayMs]);
}

export function getStatusClearDelayMs(status: string | null): number {
  const value = String(status ?? "").trim().toLowerCase();
  if (!value) return 3000;
  if (value.includes("feil") || value.includes("feilet") || value.includes("kunne ikke")) return 8000;
  return 3000;
}
