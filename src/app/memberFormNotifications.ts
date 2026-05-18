import { getOnboardingFromPersonalGoals, isOnboardingCompleted } from "./memberOnboarding";
import { getMonthlyCheckInsFromPersonalGoals } from "./memberMonthlyCheckIn";
import type { MemberFormAlertKind } from "./memberFormTrainerAlerts";

export type MemberFormSubmissionNotice = {
  kind: MemberFormAlertKind;
  formKey: string;
};

/** Stabil nøkkel for varsel/push (unngå ugyldige tegn i localStorage). */
export function normalizeMemberFormKey(value: string): string {
  return String(value ?? "")
    .trim()
    .replace(/[:.]/g, "-")
    .replace(/\s+/g, "");
}

/** Nye eller oppdaterte skjemainnsendinger siden forrige lagrede personalGoals. */
export function detectNewMemberFormSubmissions(
  previousPersonalGoals: string | undefined,
  nextPersonalGoals: string | undefined,
): MemberFormSubmissionNotice[] {
  const notices: MemberFormSubmissionNotice[] = [];
  const before = String(previousPersonalGoals ?? "");
  const after = String(nextPersonalGoals ?? "");

  if (isOnboardingCompleted(after)) {
    const nextOnboarding = getOnboardingFromPersonalGoals(after);
    const prevOnboarding = getOnboardingFromPersonalGoals(before);
    if (
      nextOnboarding?.completedAt &&
      !nextOnboarding.skipped &&
      nextOnboarding.completedAt !== prevOnboarding?.completedAt
    ) {
      notices.push({
        kind: "onboarding",
        formKey: normalizeMemberFormKey(nextOnboarding.completedAt),
      });
    }
  }

  const prevCheckInKeys = new Set(
    getMonthlyCheckInsFromPersonalGoals(before).map((row) => `${row.monthKey}:${row.completedAt}`),
  );
  for (const checkIn of getMonthlyCheckInsFromPersonalGoals(after)) {
    const signature = `${checkIn.monthKey}:${checkIn.completedAt}`;
    if (!checkIn.completedAt || prevCheckInKeys.has(signature)) continue;
    notices.push({
      kind: "check-in",
      formKey: normalizeMemberFormKey(checkIn.monthKey),
    });
  }

  return notices;
}
