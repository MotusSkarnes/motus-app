export const WORKOUT_LOG_URL_PARAM = "workoutLogId";

export function readWorkoutLogIdFromLocation(): string | null {
  if (typeof window === "undefined") return null;
  const id = new URLSearchParams(window.location.search).get(WORKOUT_LOG_URL_PARAM)?.trim();
  return id || null;
}

export function buildWorkoutLogDeepLinkUrl(logId: string): string {
  const trimmed = logId.trim();
  if (!trimmed) return "/";
  const params = new URLSearchParams({ [WORKOUT_LOG_URL_PARAM]: trimmed });
  return `/?${params.toString()}`;
}

export function stripWorkoutLogIdFromLocation(): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (!url.searchParams.has(WORKOUT_LOG_URL_PARAM)) return;
  url.searchParams.delete(WORKOUT_LOG_URL_PARAM);
  window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
}

export function workoutLogIdFromMemberAlertId(alertId: string): string | null {
  const prefix = "member-workout-comment-";
  if (!alertId.startsWith(prefix)) return null;
  const logId = alertId.slice(prefix.length).trim();
  return logId || null;
}
