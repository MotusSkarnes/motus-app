export const PROFILE_METRICS_PREFIX = "MOTUS_PROFILE_V1:";

export function parsePersonalGoalsJson(personalGoals: string | undefined): Record<string, unknown> | null {
  const trimmed = String(personalGoals ?? "").trim();
  if (!trimmed) return null;

  let jsonPart = "";
  if (trimmed.startsWith(PROFILE_METRICS_PREFIX)) {
    jsonPart = trimmed.slice(PROFILE_METRICS_PREFIX.length);
  } else {
    const prefixIndex = trimmed.indexOf(PROFILE_METRICS_PREFIX);
    if (prefixIndex >= 0) {
      jsonPart = trimmed.slice(prefixIndex + PROFILE_METRICS_PREFIX.length);
    } else if (trimmed.startsWith("{")) {
      jsonPart = trimmed;
    } else {
      return null;
    }
  }

  try {
    const parsed = JSON.parse(jsonPart) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Preserve non-onboarding profile payload when updating personal goals. */
export function readProfileExtensions(personalGoals: string | undefined): Record<string, unknown> {
  const payload = parsePersonalGoalsJson(personalGoals);
  if (!payload) return {};
  const extensions: Record<string, unknown> = {};
  if (payload.onboarding && typeof payload.onboarding === "object") {
    extensions.onboarding = payload.onboarding;
  }
  const completedAt = String(payload.onboardingCompletedAt ?? "").trim();
  if (completedAt) extensions.onboardingCompletedAt = completedAt;
  if (Array.isArray(payload.monthlyCheckIns)) {
    extensions.monthlyCheckIns = payload.monthlyCheckIns;
  }
  if (Array.isArray(payload.bodyMetrics)) {
    extensions.bodyMetrics = payload.bodyMetrics;
  }
  if (payload.homeVisibility && typeof payload.homeVisibility === "object") {
    extensions.homeVisibility = payload.homeVisibility;
  }
  if (Array.isArray(payload.favoritePersonalRecords)) {
    extensions.favoritePersonalRecords = payload.favoritePersonalRecords;
  }
  if (payload.notificationPreferences && typeof payload.notificationPreferences === "object") {
    extensions.notificationPreferences = payload.notificationPreferences;
  }
  if (payload.periodPlanSwaps && typeof payload.periodPlanSwaps === "object") {
    extensions.periodPlanSwaps = payload.periodPlanSwaps;
  }
  if (payload.periodPlanCompletion && typeof payload.periodPlanCompletion === "object") {
    extensions.periodPlanCompletion = payload.periodPlanCompletion;
  }
  if (payload.foodAvoidances && typeof payload.foodAvoidances === "object") {
    extensions.foodAvoidances = payload.foodAvoidances;
  }
  if (payload.memberAppUi && typeof payload.memberAppUi === "object") {
    extensions.memberAppUi = payload.memberAppUi;
  }
  if (typeof payload.profileDisplayName === "string" && payload.profileDisplayName.trim()) {
    extensions.profileDisplayName = payload.profileDisplayName.trim();
  }
  return extensions;
}
