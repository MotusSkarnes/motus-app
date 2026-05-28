import { parsePersonalGoalsJson } from "./memberOnboarding";

const PROFILE_METRICS_PREFIX = "MOTUS_PROFILE_V1:";

export type MemberAppUiState = {
  welcomeSeenAt?: string;
  onboardingGateSeenAt?: string;
  profileDisplayName?: string;
};

export function readMemberAppUiState(personalGoals: string | undefined): MemberAppUiState {
  const payload = parsePersonalGoalsJson(personalGoals);
  if (!payload) return {};
  const row = payload.memberAppUi;
  if (!row || typeof row !== "object") return {};
  const record = row as Record<string, unknown>;
  return {
    welcomeSeenAt: typeof record.welcomeSeenAt === "string" ? record.welcomeSeenAt : undefined,
    onboardingGateSeenAt:
      typeof record.onboardingGateSeenAt === "string" ? record.onboardingGateSeenAt : undefined,
    profileDisplayName: typeof record.profileDisplayName === "string" ? record.profileDisplayName : undefined,
  };
}

export function patchMemberAppUiStateInPersonalGoals(
  existingPersonalGoals: string | undefined,
  patch: Partial<MemberAppUiState>,
): string {
  const existing = parsePersonalGoalsJson(existingPersonalGoals) ?? {};
  const current = readMemberAppUiState(existingPersonalGoals);
  const nextUi: MemberAppUiState = {
    ...current,
    ...patch,
  };
  const payload = {
    ...existing,
    memberAppUi: {
      ...(typeof existing.memberAppUi === "object" && existing.memberAppUi ? (existing.memberAppUi as object) : {}),
      ...nextUi,
    },
  };
  return `${PROFILE_METRICS_PREFIX}${JSON.stringify(payload)}`;
}

export function readProfileDisplayName(personalGoals: string | undefined): string {
  const fromUi = readMemberAppUiState(personalGoals).profileDisplayName?.trim() ?? "";
  if (fromUi) return fromUi;
  const payload = parsePersonalGoalsJson(personalGoals);
  const legacy = typeof payload?.profileDisplayName === "string" ? payload.profileDisplayName.trim() : "";
  return legacy;
}
