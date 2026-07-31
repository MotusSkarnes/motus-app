type ClientDiagnosticLevel = "info" | "error";

export type ClientDiagnosticContext = Record<string, unknown>;

export function reportClientDiagnostic(
  event: string,
  context: ClientDiagnosticContext = {},
  level: ClientDiagnosticLevel = "info",
): void {
  if (typeof window === "undefined") return;
  const payload = JSON.stringify({
    event,
    level,
    context,
    path: window.location.pathname,
    userAgent: window.navigator.userAgent,
    occurredAt: new Date().toISOString(),
  });

  try {
    if (window.navigator.sendBeacon) {
      const sent = window.navigator.sendBeacon(
        "/api/client-error",
        new Blob([payload], { type: "application/json" }),
      );
      if (sent) return;
    }
  } catch {
    // Fall back to fetch.
  }

  void fetch("/api/client-error", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true,
  }).catch(() => {});
}

export function reportClientError(event: string, error: unknown, context: ClientDiagnosticContext = {}): void {
  const value = error instanceof Error ? error : new Error(String(error ?? "Unknown client error"));
  reportClientDiagnostic(
    event,
    {
      ...context,
      errorName: value.name,
      errorMessage: value.message,
      stack: value.stack?.slice(0, 4000) ?? "",
    },
    "error",
  );
}
