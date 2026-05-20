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
  dismissedMemberCheckInMonths: string[];
  memberInspirationBaselineAt: number;
  updatedAt: number;
};

export type TrainerNotificationPreferences = {
  version: typeof MEMBER_NOTIFICATION_PREFS_VERSION;
  trainerAlertsSeenAt: number;
  trainerNotificationsBaselineAt: number;
  openedTrainerAlertIds: string[];
  seenTrainerOperationalAlertKey: string;
  seenTrainerMemberFormKeys: string[];
  updatedAt: number;
};

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
    dismissedMemberCheckInMonths: uniqueStrings(
      Array.isArray(record.dismissedMemberCheckInMonths)
        ? record.dismissedMemberCheckInMonths.filter((item): item is string => typeof item === "string")
        : [],
    ),
    memberInspirationBaselineAt: Number(record.memberInspirationBaselineAt) || 0,
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
    seenMemberProgramIds: uniqueStrings([...base.seenMemberProgramIds, ...other.seenMemberProgramIds]),
    seenMemberWorkoutCommentKeys: uniqueStrings([
      ...base.seenMemberWorkoutCommentKeys,
      ...other.seenMemberWorkoutCommentKeys,
    ]),
    openedMemberAlertIds: uniqueStrings([...base.openedMemberAlertIds, ...other.openedMemberAlertIds]),
    seenMemberInspirationIds: uniqueStrings([...base.seenMemberInspirationIds, ...other.seenMemberInspirationIds]),
    dismissedMemberCheckInMonths: uniqueStrings([
      ...base.dismissedMemberCheckInMonths,
      ...other.dismissedMemberCheckInMonths,
    ]),
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
    openedTrainerAlertIds: uniqueStrings([...base.openedTrainerAlertIds, ...other.openedTrainerAlertIds]),
    seenTrainerOperationalAlertKey: base.seenTrainerOperationalAlertKey || other.seenTrainerOperationalAlertKey,
    seenTrainerMemberFormKeys: uniqueStrings([
      ...base.seenTrainerMemberFormKeys,
      ...other.seenTrainerMemberFormKeys,
    ]),
    updatedAt: Math.max(base.updatedAt, other.updatedAt, Date.now()),
  };
}
