const PROFILE_METRICS_PREFIX = "MOTUS_PROFILE_V1:";

/** Velg rikeste personal_goals når samme kunde har flere member-rader. */
export function pickBestPersonalGoals(candidates: Array<string | undefined | null>): string {
  let best = "";
  let bestScore = -1;
  for (const raw of candidates) {
    const value = String(raw ?? "").trim();
    if (!value) continue;
    let score = 0;
    if (value.startsWith(PROFILE_METRICS_PREFIX)) score += 100;
    if (value.includes("onboardingCompletedAt")) score += 200;
    if (value.includes('"onboarding"') && value.includes("completedAt")) score += 160;
    else if (value.includes('"onboarding"')) score += 80;
    if (value.includes('"monthlyCheckIns"')) score += 50;
    if (value.includes('"notificationPreferences"')) score += 120;
    if (value.includes('"memberAppUi"')) score += 80;
    if (value.includes('"profileDisplayName"')) score += 60;
    if (value.includes('"periodPlanCompletion"')) score += 140;
    if (value.includes('"openedMemberAlertIds"')) score += 40;
    if (value.includes('"seenHiddenBadgeIds"')) score += 40;
    score += Math.min(20, Math.floor(value.length / 200));
    if (score > bestScore) {
      bestScore = score;
      best = value;
    }
  }
  return best;
}
