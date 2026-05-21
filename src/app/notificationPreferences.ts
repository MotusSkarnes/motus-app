import { parsePersonalGoalsJson } from "./memberOnboarding";

const PROFILE_METRICS_PREFIX = "MOTUS_PROFILE_V1:";

export const MEMBER_NOTIFICATION_PREFS_VERSION = 1;
export const TRAINER_NOTIFICATION_PREFS_METADATA_KEY = "motus_notification_preferences";

export type MemberNotificationPreferences = {
  version: typeof MEMBER_NOTIFICATION_PREFS_VERSION;
  memberAlertsSeenAt: number;
  seenMemberProgramIds: string[];
  seenMemberWorkoutCommentKeys: string[];
  openedMemberAlertIds: string[];
  seenMemberInspirationIds: string[];
  seenMemberPeriodPlanKeys: string[];
  dismissedMemberCheckInMonths: string[];
  memberInspirationBaselineAt: number;
  /** Skjulte badges som er «sett» (ingen popup på nytt på annen enhet). */
  seenHiddenBadgeIds: string[];
  /** Siste nivå som allerede er feiret med popup (unngår gjentatt feiring). */
  lastCelebratedAchievedLevel: number;
  updatedAt: number;
};

export function emptyMemberNotificationPreferences(): MemberNotificationPreferences {
  return {
    version: MEMBER_NOTIFICATION_PREFS_VERSION,
    memberAlertsSeenAt: 0,
    seenMemberProgramIds: [],
    seenMemberWorkoutCommentKeys: [],
    openedMemberAlertIds: [],
    seenMemberInspirationIds: [],
    seenMemberPeriodPlanKeys: [],
    dismissedMemberCheckInMonths: [],
    memberInspirationBaselineAt: 0,
    seenHiddenBadgeIds: [],
    lastCelebratedAchievedLevel: 0,
    updatedAt: 0,
  };
}

export type TrainerNotificationPreferences = {
  version: typeof MEMBER_NOTIFICATION_PREFS_VERSION;
  trainerAlertsSeenAt: number;
  trainerNotificationsBaselineAt: number;
  openedTrainerAlertIds: string[];
  seenTrainerOperationalAlertKey: string;
  seenTrainerMemberFormKeys: string[];
  updatedAt: number;
};

export function emptyTrainerNotificationPreferences(): TrainerNotificationPreferences {
  return {
    version: MEMBER_NOTIFICATION_PREFS_VERSION,
    trainerAlertsSeenAt: 0,
    trainerNotificationsBaselineAt: 0,
    openedTrainerAlertIds: [],
    seenTrainerOperationalAlertKey: "",
    seenTrainerMemberFormKeys: [],
    updatedAt: 0,
  };
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function normalizeMemberNotificationPreferences(raw: unknown): MemberNotificationPreferences | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  if (Number(record.version) !== MEMBER_NOTIFICATION_PREFS_VERSION) return null;
  return {
    version: MEMBER_NOTIFICATION_PREFS_VERSION,
    memberAlertsSeenAt: Number(record.memberAlertsSeenAt) || 0,
    seenMemberProgramIds: uniqueStrings(
      Array.isArray(record.seenMemberProgramIds)
        ? record.seenMemberProgramIds.filter((item): item is string => typeof item === "string")
        : [],
    ),
    seenMemberWorkoutCommentKeys: uniqueStrings(
      Array.isArray(record.seenMemberWorkoutCommentKeys)
        ? record.seenMemberWorkoutCommentKeys.filter((item): item is string => typeof item === "string")
        : [],
    ),
    openedMemberAlertIds: uniqueStrings(
      Array.isArray(record.openedMemberAlertIds)
        ? record.openedMemberAlertIds.filter((item): item is string => typeof item === "string")
        : [],
    ),
    seenMemberInspirationIds: uniqueStrings(
      Array.isArray(record.seenMemberInspirationIds)
        ? record.seenMemberInspirationIds.filter((item): item is string => typeof item === "string")
        : [],
    ),
    seenMemberPeriodPlanKeys: uniqueStrings(
      Array.isArray(record.seenMemberPeriodPlanKeys)
        ? record.seenMemberPeriodPlanKeys.filter((item): item is string => typeof item === "string")
        : [],
    ),
    dismissedMemberCheckInMonths: uniqueStrings(
      Array.isArray(record.dismissedMemberCheckInMonths)
        ? record.dismissedMemberCheckInMonths.filter((item): item is string => typeof item === "string")
        : [],
    ),
    memberInspirationBaselineAt: Number(record.memberInspirationBaselineAt) || 0,
    seenHiddenBadgeIds: uniqueStrings(
      Array.isArray(record.seenHiddenBadgeIds)
        ? record.seenHiddenBadgeIds.filter((item): item is string => typeof item === "string")
        : [],
    ),
    lastCelebratedAchievedLevel: Number(record.lastCelebratedAchievedLevel) || 0,
    updatedAt: Number(record.updatedAt) || 0,
  };
}

function normalizeTrainerNotificationPreferences(raw: unknown): TrainerNotificationPreferences | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  if (Number(record.version) !== MEMBER_NOTIFICATION_PREFS_VERSION) return null;
  return {
    version: MEMBER_NOTIFICATION_PREFS_VERSION,
    trainerAlertsSeenAt: Number(record.trainerAlertsSeenAt) || 0,
    trainerNotificationsBaselineAt: Number(record.trainerNotificationsBaselineAt) || 0,
    openedTrainerAlertIds: uniqueStrings(
      Array.isArray(record.openedTrainerAlertIds)
        ? record.openedTrainerAlertIds.filter((item): item is string => typeof item === "string")
        : [],
    ),
    seenTrainerOperationalAlertKey: String(record.seenTrainerOperationalAlertKey ?? ""),
    seenTrainerMemberFormKeys: uniqueStrings(
      Array.isArray(record.seenTrainerMemberFormKeys)
        ? record.seenTrainerMemberFormKeys.filter((item): item is string => typeof item === "string")
        : [],
    ),
    updatedAt: Number(record.updatedAt) || 0,
  };
}

export function readMemberNotificationPreferencesFromPersonalGoals(
  personalGoals: string | undefined,
): MemberNotificationPreferences | null {
  const payload = parsePersonalGoalsJson(personalGoals);
  if (!payload) return null;
  return normalizeMemberNotificationPreferences(payload.notificationPreferences);
}

export function patchMemberNotificationPreferencesInPersonalGoals(
  existingPersonalGoals: string | undefined,
  patch: Partial<MemberNotificationPreferences>,
): string {
  const current =
    readMemberNotificationPreferencesFromPersonalGoals(existingPersonalGoals) ??
    emptyMemberNotificationPreferences();
  return mergeMemberNotificationPreferencesIntoPersonalGoals(existingPersonalGoals, {
    ...current,
    ...patch,
    updatedAt: Date.now(),
  });
}

export function readTrainerNotificationPreferencesFromUserMetadata(
  userMetadata: Record<string, unknown> | undefined,
): TrainerNotificationPreferences | null {
  if (!userMetadata) return null;
  return normalizeTrainerNotificationPreferences(userMetadata[TRAINER_NOTIFICATION_PREFS_METADATA_KEY]);
}

export function mergeMemberNotificationPreferencesIntoPersonalGoals(
  existingPersonalGoals: string | undefined,
  preferences: MemberNotificationPreferences,
): string {
  const existing = parsePersonalGoalsJson(existingPersonalGoals) ?? {};
  const payload = {
    ...existing,
    notificationPreferences: {
      ...preferences,
      updatedAt: Date.now(),
    },
  };
  return `${PROFILE_METRICS_PREFIX}${JSON.stringify(payload)}`;
}

export function mergeMemberNotificationPreferences(
  local: MemberNotificationPreferences,
  remote: MemberNotificationPreferences | null | undefined,
): MemberNotificationPreferences {
  if (!remote) return local;
  const useRemoteBase = remote.updatedAt > local.updatedAt;
  const base = useRemoteBase ? remote : local;
  const other = useRemoteBase ? local : remote;
  return {
    version: MEMBER_NOTIFICATION_PREFS_VERSION,
    memberAlertsSeenAt: Math.max(base.memberAlertsSeenAt, other.memberAlertsSeenAt),
    memberInspirationBaselineAt: Math.max(base.memberInspirationBaselineAt, other.memberInspirationBaselineAt),
    seenMemberProgramIds: uniqueStrings([
      ...(base.seenMemberProgramIds ?? []),
      ...(other.seenMemberProgramIds ?? []),
    ]),
    seenMemberWorkoutCommentKeys: uniqueStrings([
      ...(base.seenMemberWorkoutCommentKeys ?? []),
      ...(other.seenMemberWorkoutCommentKeys ?? []),
    ]),
    openedMemberAlertIds: uniqueStrings([
      ...(base.openedMemberAlertIds ?? []),
      ...(other.openedMemberAlertIds ?? []),
    ]),
    seenMemberInspirationIds: uniqueStrings([
      ...(base.seenMemberInspirationIds ?? []),
      ...(other.seenMemberInspirationIds ?? []),
    ]),
    seenMemberPeriodPlanKeys: uniqueStrings([
      ...(base.seenMemberPeriodPlanKeys ?? []),
      ...(other.seenMemberPeriodPlanKeys ?? []),
    ]),
    dismissedMemberCheckInMonths: uniqueStrings([
      ...(base.dismissedMemberCheckInMonths ?? []),
      ...(other.dismissedMemberCheckInMonths ?? []),
    ]),
    seenHiddenBadgeIds: uniqueStrings([
      ...(base.seenHiddenBadgeIds ?? []),
      ...(other.seenHiddenBadgeIds ?? []),
    ]),
    lastCelebratedAchievedLevel: Math.max(
      base.lastCelebratedAchievedLevel ?? 0,
      other.lastCelebratedAchievedLevel ?? 0,
    ),
    updatedAt: Math.max(base.updatedAt, other.updatedAt, Date.now()),
  };
}

export function mergeTrainerNotificationPreferences(
  local: TrainerNotificationPreferences,
  remote: TrainerNotificationPreferences | null | undefined,
): TrainerNotificationPreferences {
  if (!remote) return local;
  const useRemoteBase = remote.updatedAt > local.updatedAt;
  const base = useRemoteBase ? remote : local;
  const other = useRemoteBase ? local : remote;
  return {
    version: MEMBER_NOTIFICATION_PREFS_VERSION,
    trainerAlertsSeenAt: Math.max(base.trainerAlertsSeenAt, other.trainerAlertsSeenAt),
    trainerNotificationsBaselineAt: Math.max(base.trainerNotificationsBaselineAt, other.trainerNotificationsBaselineAt),
    openedTrainerAlertIds: uniqueStrings([
      ...(base.openedTrainerAlertIds ?? []),
      ...(other.openedTrainerAlertIds ?? []),
    ]),
    seenTrainerOperationalAlertKey:
      base.seenTrainerOperationalAlertKey.length >= other.seenTrainerOperationalAlertKey.length
        ? base.seenTrainerOperationalAlertKey
        : other.seenTrainerOperationalAlertKey,
    seenTrainerMemberFormKeys: uniqueStrings([
      ...(base.seenTrainerMemberFormKeys ?? []),
      ...(other.seenTrainerMemberFormKeys ?? []),
    ]),
    updatedAt: Math.max(base.updatedAt, other.updatedAt, Date.now()),
  };
}
