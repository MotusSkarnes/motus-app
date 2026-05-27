import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  buildInspirationNotificationAlertCopy,
  parseInspirationNotificationTimestamp,
} from "./inspirationNotifications";
import {
  INSPIRATION_CHANGED_EVENT,
  loadInspirationNotificationItems,
  refreshInspirationNotificationItemsFromRemote,
  type InspirationNotificationItem,
} from "./inspirationStorage";
import { trainerInactiveDaysForFollowUp } from "./memberActivity";
import { memberIdentityKey, rosterMembersMissingInvite } from "./memberInviteStatus";
import { buildMemberFormTrainerAlerts } from "./memberFormTrainerAlerts";
import {
  buildCheckInNotificationCopy,
  resolveCheckInWindow,
  shouldPromptMonthlyCheckIn,
} from "./memberMonthlyCheckIn";
import { formatNotificationTimestamp } from "./dateFormat";
import { parseChatMessageCreatedAtMs } from "./messageHydrationMerge";
import { dedupeTrainingPrograms, programIsInMemberArchive } from "./programBlocks";
import type { ChatMessage, Member, MemberTab, PeriodSchedulePlan, TrainingProgram, WorkoutLog } from "./types";
import { readWorkoutLogIdFromLocation, stripWorkoutLogIdFromLocation, workoutLogIdFromMemberAlertId } from "./workoutLogDeepLink";
import {
  MEMBER_NOTIFICATION_PREFS_VERSION,
  emptyMemberNotificationPreferences,
  emptyTrainerNotificationPreferences,
  mergeMemberNotificationPreferences,
  mergeTrainerNotificationPreferences,
  readMemberNotificationPreferencesFromPersonalGoals,
  readTrainerNotificationPreferencesFromUserMetadata,
  TRAINER_NOTIFICATION_PREFS_METADATA_KEY,
  type MemberNotificationPreferences,
  type TrainerNotificationPreferences,
} from "./notificationPreferences";
import { isSupabaseConfigured, supabaseClient } from "../services/supabaseClient";

const MEMBER_INSPIRATION_BASELINE_KEY = "motus.notifications.memberInspirationBaselineAt";
const TRAINER_NOTIFICATIONS_BASELINE_KEY = "motus.notifications.trainerBaselineAt";

const ALERT_HISTORY_LIMIT = 5;
/** Operational varsler har ikke reell mottatt-tid — 0 skjuler dato i UI. */
const TRAINER_OPERATIONAL_TIMESTAMP = 0;
const TRAINER_OPERATIONAL_ALERT_IDS = {
  missingInvite: "trainer-op-missing-invites",
  inactiveMember: "trainer-op-inactive-members",
} as const;

export type MemberAlert = {
  id: string;
  kind: "message" | "program" | "workout-comment" | "inspiration" | "check-in" | "period-plan";
  title: string;
  text: string;
  detail: string;
  timestamp: number;
  targetTab: "messages" | "programs" | "progress" | "inspiration";
  isUnread: boolean;
  isOpened: boolean;
  inspirationItemId?: string;
};

export type TrainerAlert = {
  id: string;
  kind: "message" | "missing-invite" | "inactive-member" | "member-form";
  memberId: string;
  title: string;
  text: string;
  detail: string;
  timestamp: number;
  isUnread: boolean;
  isOpened: boolean;
};

function parseTimestamp(value: string, fallbackOrder: number): number {
  const parsed = parseChatMessageCreatedAtMs(value);
  return parsed > 0 ? parsed : fallbackOrder;
}

function isOperationalTrainerAlertKind(kind?: string): boolean {
  return kind === "missing-invite" || kind === "inactive-member";
}

function sortAlertsForDisplay<T extends { timestamp: number; isUnread?: boolean; unread?: boolean; kind?: string }>(
  alerts: T[],
): T[] {
  return [...alerts].sort((a, b) => {
    const aUnread = Boolean(a.isUnread ?? a.unread);
    const bUnread = Boolean(b.isUnread ?? b.unread);
    if (aUnread !== bUnread) return aUnread ? -1 : 1;
    const aOperational = isOperationalTrainerAlertKind(a.kind);
    const bOperational = isOperationalTrainerAlertKind(b.kind);
    if (aOperational !== bOperational) return aOperational ? 1 : -1;
    return b.timestamp - a.timestamp;
  });
}

function isCompletedWorkoutLog(log: WorkoutLog): boolean {
  const status = String(log.status ?? "").trim();
  if (status === "Fullført") return true;
  return status.toLowerCase().replace(/ø/g, "o") === "fullfort";
}

function readMemberInspirationBaselineAt(): number {
  if (typeof window === "undefined") return 0;
  const parsed = Number(window.localStorage.getItem(MEMBER_INSPIRATION_BASELINE_KEY) ?? "0");
  return Number.isFinite(parsed) ? parsed : 0;
}

function memberPeriodPlanSeenKey(plan: PeriodSchedulePlan): string {
  const version = plan.trainerSavedAtIso?.trim() || plan.createdAt?.trim() || plan.id;
  return `${plan.id}:${version}`;
}

function periodPlanAlertTimestamp(plan: PeriodSchedulePlan, fallbackOrder: number): number {
  const iso = plan.trainerSavedAtIso?.trim();
  if (iso) {
    const parsed = Date.parse(iso);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return parseTimestamp(plan.createdAt, fallbackOrder);
}

function readMemberTabFromLocation(): MemberTab | null {
  if (typeof window === "undefined") return null;
  const tab = new URLSearchParams(window.location.search).get("memberTab")?.trim();
  if (tab === "overview" || tab === "programs" || tab === "progress" || tab === "messages" || tab === "profile" || tab === "inspiration") {
    return tab;
  }
  return null;
}

function stripMemberTabFromLocation(): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (!url.searchParams.has("memberTab")) return;
  url.searchParams.delete("memberTab");
  const next = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState(window.history.state, "", next);
}

function readTrainerBaselineAt(): number {
  if (typeof window === "undefined") return 0;
  const parsed = Number(window.localStorage.getItem(TRAINER_NOTIFICATIONS_BASELINE_KEY) ?? "0");
  return Number.isFinite(parsed) ? parsed : 0;
}

export function useNotifications({
  messages,
  programs,
  logs,
  members,
  memberViewId,
  memberPersonalGoals,
  memberNotificationProfileReady,
  currentUserRole,
  setMemberTab,
  onTrainerOpenMessage,
  onTrainerOpenCustomers,
  onTrainerOpenMemberForm,
  onPersistMemberNotificationPreferences,
  remoteMemberPeriodPlanRows = [],
}: {
  messages: ChatMessage[];
  programs: TrainingProgram[];
  logs: WorkoutLog[];
  members: Member[];
  memberViewId: string;
  remoteMemberPeriodPlanRows?: Array<{ memberId: string; plan: PeriodSchedulePlan }>;
  memberPersonalGoals?: string;
  /** True når medlemsrad (personal_goals) er lastet — unngår tom lokal tilstand på ny enhet før sky-synk. */
  memberNotificationProfileReady?: boolean;
  currentUserRole?: "trainer" | "member";
  setMemberTab: (tab: MemberTab) => void;
  onTrainerOpenMessage?: (memberId: string) => void;
  onTrainerOpenCustomers?: () => void;
  onTrainerOpenMemberForm?: (memberId: string) => void;
  onPersistMemberNotificationPreferences?: (preferences: MemberNotificationPreferences) => void;
}) {
  const skipMemberPersistRef = useRef(false);
  const skipTrainerPersistRef = useRef(false);
  const lastPersistedMemberPrefsRef = useRef("");
  const lastPersistedTrainerPrefsRef = useRef("");
  const memberPrefsHydratedRef = useRef(false);
  const memberCloudPrefsSyncedRef = useRef(false);
  const trainerPrefsHydratedRef = useRef(false);
  const trainerBaselineSeedAppliedRef = useRef(false);
  const lastMergedMemberPersonalGoalsRef = useRef<string | undefined>(undefined);
  const isMemberSession = currentUserRole === "member";
  const memberProfileReady =
    memberNotificationProfileReady ??
    (isMemberSession && Boolean(memberViewId && members.some((member) => member.id === memberViewId)));
  const [trainerNotificationsOpen, setTrainerNotificationsOpen] = useState(false);
  const [memberNotificationsOpen, setMemberNotificationsOpen] = useState(false);
  const [trainerAlertsSeenAt, setTrainerAlertsSeenAt] = useState(() => {
    if (typeof window === "undefined") return 0;
    const raw = window.localStorage.getItem("motus.notifications.trainerSeenAt");
    const parsed = Number(raw ?? "0");
    return Number.isFinite(parsed) ? parsed : 0;
  });
  const [memberAlertsSeenAt, setMemberAlertsSeenAt] = useState(() => {
    if (typeof window === "undefined") return 0;
    const raw = window.localStorage.getItem("motus.notifications.memberSeenAt");
    const parsed = Number(raw ?? "0");
    return Number.isFinite(parsed) ? parsed : 0;
  });
  const [trainerNotificationsBaselineAt, setTrainerNotificationsBaselineAt] = useState(() => {
    if (typeof window === "undefined") return 0;
    const raw = window.localStorage.getItem(TRAINER_NOTIFICATIONS_BASELINE_KEY);
    const parsed = Number(raw ?? "0");
    return Number.isFinite(parsed) ? parsed : 0;
  });
  const [seenMemberProgramIds, setSeenMemberProgramIds] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem("motus.notifications.memberSeenProgramIds");
      const parsed = JSON.parse(raw ?? "[]");
      return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
    } catch {
      return [];
    }
  });
  const [seenMemberWorkoutCommentKeys, setSeenMemberWorkoutCommentKeys] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem("motus.notifications.memberSeenWorkoutCommentKeys");
      const parsed = JSON.parse(raw ?? "[]");
      return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
    } catch {
      return [];
    }
  });
  const [openedMemberAlertIds, setOpenedMemberAlertIds] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem("motus.notifications.memberOpenedAlertIds");
      const parsed = JSON.parse(raw ?? "[]");
      return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
    } catch {
      return [];
    }
  });
  const [openedTrainerAlertIds, setOpenedTrainerAlertIds] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem("motus.notifications.trainerOpenedAlertIds");
      const parsed = JSON.parse(raw ?? "[]");
      return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
    } catch {
      return [];
    }
  });
  const [seenTrainerOperationalAlertKey, setSeenTrainerOperationalAlertKey] = useState(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem("motus.notifications.trainerOperationalSeenKey") ?? "";
  });
  const [seenMemberInspirationIds, setSeenMemberInspirationIds] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem("motus.notifications.memberSeenInspirationIds");
      const parsed = JSON.parse(raw ?? "[]");
      return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
    } catch {
      return [];
    }
  });
  const [inspirationItems, setInspirationItems] = useState<InspirationNotificationItem[]>(() => loadInspirationNotificationItems());
  const [memberFocusInspirationItemId, setMemberFocusInspirationItemId] = useState<string | null>(null);
  const [memberFocusWorkoutLogId, setMemberFocusWorkoutLogId] = useState<string | null>(() => readWorkoutLogIdFromLocation());
  const [memberFocusProgramId, setMemberFocusProgramId] = useState<string | null>(null);
  const [memberCheckInOverlayOpen, setMemberCheckInOverlayOpen] = useState(false);
  const [seenTrainerMemberFormKeys, setSeenTrainerMemberFormKeys] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem("motus.notifications.trainerSeenMemberFormKeys");
      const parsed = JSON.parse(raw ?? "[]");
      return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
    } catch {
      return [];
    }
  });
  const [dismissedMemberCheckInMonths, setDismissedMemberCheckInMonths] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem("motus.notifications.memberDismissedCheckInMonths");
      const parsed = JSON.parse(raw ?? "[]");
      return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
    } catch {
      return [];
    }
  });
  const [seenMemberPeriodPlanKeys, setSeenMemberPeriodPlanKeys] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem("motus.notifications.memberSeenPeriodPlanKeys");
      const parsed = JSON.parse(raw ?? "[]");
      return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
    } catch {
      return [];
    }
  });

  const lastMergedTrainerRemoteUpdatedAtRef = useRef(0);

  const buildMemberNotificationSnapshot = useCallback((): MemberNotificationPreferences => {
    return {
      version: MEMBER_NOTIFICATION_PREFS_VERSION,
      memberAlertsSeenAt,
      seenMemberProgramIds,
      seenMemberWorkoutCommentKeys,
      openedMemberAlertIds,
      seenMemberInspirationIds,
      seenMemberPeriodPlanKeys,
      dismissedMemberCheckInMonths,
      memberInspirationBaselineAt: readMemberInspirationBaselineAt(),
      updatedAt: Date.now(),
    };
  }, [
    memberAlertsSeenAt,
    seenMemberProgramIds,
    seenMemberWorkoutCommentKeys,
    openedMemberAlertIds,
    seenMemberInspirationIds,
    seenMemberPeriodPlanKeys,
    dismissedMemberCheckInMonths,
  ]);

  const buildMemberNotificationSnapshotRef = useRef(buildMemberNotificationSnapshot);
  useEffect(() => {
    buildMemberNotificationSnapshotRef.current = buildMemberNotificationSnapshot;
  }, [buildMemberNotificationSnapshot]);

  const applyMemberNotificationSnapshot = useCallback((preferences: MemberNotificationPreferences) => {
    skipMemberPersistRef.current = true;
    setMemberAlertsSeenAt(preferences.memberAlertsSeenAt);
    setSeenMemberProgramIds(preferences.seenMemberProgramIds);
    setSeenMemberWorkoutCommentKeys(preferences.seenMemberWorkoutCommentKeys);
    setOpenedMemberAlertIds(preferences.openedMemberAlertIds);
    setSeenMemberInspirationIds(preferences.seenMemberInspirationIds);
    setSeenMemberPeriodPlanKeys(preferences.seenMemberPeriodPlanKeys ?? []);
    setDismissedMemberCheckInMonths(preferences.dismissedMemberCheckInMonths);
    if (preferences.memberInspirationBaselineAt > 0 && typeof window !== "undefined") {
      window.localStorage.setItem(MEMBER_INSPIRATION_BASELINE_KEY, String(preferences.memberInspirationBaselineAt));
    }
    window.setTimeout(() => {
      skipMemberPersistRef.current = false;
    }, 0);
  }, []);

  const buildTrainerNotificationSnapshot = useCallback((): TrainerNotificationPreferences => {
    return {
      version: MEMBER_NOTIFICATION_PREFS_VERSION,
      trainerAlertsSeenAt,
      trainerNotificationsBaselineAt,
      openedTrainerAlertIds,
      seenTrainerOperationalAlertKey,
      seenTrainerMemberFormKeys,
      updatedAt: Date.now(),
    };
  }, [
    trainerAlertsSeenAt,
    trainerNotificationsBaselineAt,
    openedTrainerAlertIds,
    seenTrainerOperationalAlertKey,
    seenTrainerMemberFormKeys,
  ]);

  const applyTrainerNotificationSnapshot = useCallback((preferences: TrainerNotificationPreferences) => {
    skipTrainerPersistRef.current = true;
    setTrainerAlertsSeenAt(preferences.trainerAlertsSeenAt);
    setTrainerNotificationsBaselineAt(preferences.trainerNotificationsBaselineAt);
    setOpenedTrainerAlertIds(preferences.openedTrainerAlertIds);
    setSeenTrainerOperationalAlertKey(preferences.seenTrainerOperationalAlertKey);
    setSeenTrainerMemberFormKeys(preferences.seenTrainerMemberFormKeys);
    if (preferences.trainerNotificationsBaselineAt > 0 && typeof window !== "undefined") {
      window.localStorage.setItem(
        TRAINER_NOTIFICATIONS_BASELINE_KEY,
        String(preferences.trainerNotificationsBaselineAt),
      );
    }
    window.setTimeout(() => {
      skipTrainerPersistRef.current = false;
    }, 0);
  }, []);

  const syncInspirationItemsFromStorage = useCallback(() => {
    setInspirationItems(loadInspirationNotificationItems());
  }, []);

  const pullInspirationItemsFromRemote = useCallback(() => {
    void refreshInspirationNotificationItemsFromRemote().then((items) => {
      setInspirationItems(items);
    });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onInspirationChanged = () => {
      syncInspirationItemsFromStorage();
      pullInspirationItemsFromRemote();
    };

    window.addEventListener(INSPIRATION_CHANGED_EVENT, onInspirationChanged);

    if (!memberViewId) {
      return () => window.removeEventListener(INSPIRATION_CHANGED_EVENT, onInspirationChanged);
    }

    pullInspirationItemsFromRemote();

    const intervalId = window.setInterval(pullInspirationItemsFromRemote, 60_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") pullInspirationItemsFromRemote();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", pullInspirationItemsFromRemote);

    return () => {
      window.removeEventListener(INSPIRATION_CHANGED_EVENT, onInspirationChanged);
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", pullInspirationItemsFromRemote);
    };
  }, [memberViewId, pullInspirationItemsFromRemote, syncInspirationItemsFromStorage]);

  /** Første besøk på enhet: bruk sky-baseline hvis den finnes, ellers «nå» (kun nye inspo etterpå). */
  useEffect(() => {
    if (typeof window === "undefined" || !isMemberSession || !memberProfileReady) return;
    if (!memberPrefsHydratedRef.current) return;
    if (window.localStorage.getItem(MEMBER_INSPIRATION_BASELINE_KEY)) return;
    if (inspirationItems.length === 0) return;
    const remote = readMemberNotificationPreferencesFromPersonalGoals(memberPersonalGoals);
    const baselineAt =
      remote?.memberInspirationBaselineAt && remote.memberInspirationBaselineAt > 0
        ? remote.memberInspirationBaselineAt
        : Date.now();
    window.localStorage.setItem(MEMBER_INSPIRATION_BASELINE_KEY, String(baselineAt));
  }, [inspirationItems, isMemberSession, memberPersonalGoals, memberProfileReady]);

  const memberById = useMemo(() => new Map(members.map((member) => [member.id, member])), [members]);

  const activeMember = useMemo(
    () => (memberViewId ? memberById.get(memberViewId) ?? null : null),
    [memberById, memberViewId],
  );

  const rosterMembers = useMemo(() => members.filter((member) => member.isActive !== false), [members]);

  const missingInviteMemberIds = useMemo(
    () =>
      rosterMembersMissingInvite(rosterMembers, members, { messages, logs })
        .map((member) => memberIdentityKey(member))
        .sort(),
    [rosterMembers, members, messages, logs],
  );
  const inactiveMemberIds = useMemo(
    () =>
      rosterMembers
        .filter((member) => (trainerInactiveDaysForFollowUp(member, members, logs) ?? -1) >= 7)
        .map((member) => member.id)
        .sort(),
    [rosterMembers, members, logs],
  );
  const trainerOperationalAlertKey = `${missingInviteMemberIds.join(",")}|${inactiveMemberIds.join(",")}`;

  const seedTrainerNotificationsBaseline = useCallback(() => {
    if (typeof window === "undefined" || trainerBaselineSeedAppliedRef.current) return;
    if (members.length === 0 && messages.length === 0) return;

    const latestMemberMessageTime = messages
      .filter((message) => message.sender === "member")
      .reduce((max, message, index) => Math.max(max, parseTimestamp(message.createdAt, index + 1)), 0);

    const existingBaseline = Number(window.localStorage.getItem(TRAINER_NOTIFICATIONS_BASELINE_KEY) ?? "0");
    if (
      Number.isFinite(existingBaseline) &&
      existingBaseline > 0 &&
      (latestMemberMessageTime === 0 || existingBaseline >= latestMemberMessageTime)
    ) {
      trainerBaselineSeedAppliedRef.current = true;
      return;
    }

    const existingMemberFormAlertIds = buildMemberFormTrainerAlerts(members, new Set()).map((alert) => alert.id);
    const baselineAt = latestMemberMessageTime;

    window.localStorage.setItem(TRAINER_NOTIFICATIONS_BASELINE_KEY, String(baselineAt));
    setTrainerNotificationsBaselineAt(baselineAt);
    setTrainerAlertsSeenAt((prev) => Math.max(prev, latestMemberMessageTime));
    setSeenTrainerMemberFormKeys((prev) => Array.from(new Set([...prev, ...existingMemberFormAlertIds])));
    setSeenTrainerOperationalAlertKey(trainerOperationalAlertKey);
    trainerBaselineSeedAppliedRef.current = true;
  }, [members, messages, trainerOperationalAlertKey]);

  const trainerMessageAlerts = useMemo(
    () =>
      messages
        .filter((message) => message.sender === "member")
        .map((message, index) => {
          const timestamp = parseTimestamp(message.createdAt, index + 1);
          const member = memberById.get(message.memberId);
          const name = member?.name || "Et medlem";
          const id = `trainer-msg-${message.id}`;
          return {
            id,
            kind: "message" as const,
            memberId: message.memberId,
            title: "Ny melding",
            text: `${name} har sendt deg en ny melding`,
            detail: message.text.length > 72 ? `${message.text.slice(0, 72)}...` : message.text,
            timestamp,
            unread: timestamp > trainerAlertsSeenAt && !openedTrainerAlertIds.includes(id),
          };
        })
        .filter((alert) => alert.timestamp > trainerNotificationsBaselineAt || openedTrainerAlertIds.includes(alert.id)),
    [messages, memberById, trainerAlertsSeenAt, trainerNotificationsBaselineAt, openedTrainerAlertIds],
  );

  const trainerMemberFormAlerts = useMemo(
    () =>
      buildMemberFormTrainerAlerts(members, new Set(seenTrainerMemberFormKeys)).map((alert) => ({
        id: alert.id,
        kind: "member-form" as const,
        memberId: alert.memberId,
        title: alert.title,
        text: alert.text,
        detail: alert.detail,
        timestamp: alert.timestamp,
        unread: !openedTrainerAlertIds.includes(alert.id),
      })),
    [members, seenTrainerMemberFormKeys, openedTrainerAlertIds],
  );

  const trainerOperationalAlerts = useMemo<TrainerAlert[]>(() => {
    const alerts: TrainerAlert[] = [];
    if (missingInviteMemberIds.length > 0) {
      const id = TRAINER_OPERATIONAL_ALERT_IDS.missingInvite;
      const isOpened = openedTrainerAlertIds.includes(id);
      alerts.push({
        id,
        kind: "missing-invite",
        memberId: "",
        title: "Invitasjoner",
        text: `${missingInviteMemberIds.length} kunder mangler invitasjon`,
        detail: "Gå til klienter og send invitasjon.",
        timestamp: TRAINER_OPERATIONAL_TIMESTAMP,
        isUnread: !isOpened,
        isOpened,
      });
    }
    if (inactiveMemberIds.length > 0) {
      const id = TRAINER_OPERATIONAL_ALERT_IDS.inactiveMember;
      const isOpened = openedTrainerAlertIds.includes(id);
      alerts.push({
        id,
        kind: "inactive-member",
        memberId: "",
        title: "Oppfølging",
        text: `${inactiveMemberIds.length} kunder bør følges opp`,
        detail: "Åpne klientlisten og prioriter oppfølging.",
        timestamp: TRAINER_OPERATIONAL_TIMESTAMP,
        isUnread: !isOpened,
        isOpened,
      });
    }
    return alerts;
  }, [missingInviteMemberIds.length, inactiveMemberIds.length, openedTrainerAlertIds]);

  const trainerRecentAlerts = useMemo<TrainerAlert[]>(() => {
    const combined: TrainerAlert[] = [
      ...trainerMemberFormAlerts.map((alert) => ({
        id: alert.id,
        kind: alert.kind,
        memberId: alert.memberId,
        title: alert.title,
        text: alert.text,
        detail: alert.detail,
        timestamp: alert.timestamp,
        isUnread: alert.unread,
        isOpened: openedTrainerAlertIds.includes(alert.id),
      })),
      ...trainerMessageAlerts.map((alert) => ({
        id: alert.id,
        kind: alert.kind,
        memberId: alert.memberId,
        title: alert.title,
        text: alert.text,
        detail: alert.detail,
        timestamp: alert.timestamp,
        isUnread: alert.unread,
        isOpened: openedTrainerAlertIds.includes(alert.id),
      })),
      ...trainerOperationalAlerts,
    ];
    return sortAlertsForDisplay(combined).filter((alert) => alert.isUnread || alert.isOpened).slice(0, ALERT_HISTORY_LIMIT);
  }, [trainerMemberFormAlerts, trainerMessageAlerts, trainerOperationalAlerts, openedTrainerAlertIds]);

  const memberPrograms = useMemo(
    () =>
      programs
        .map((program, index) => ({
          ...program,
          _effectiveTimestamp: parseTimestamp(program.createdAt, index + 1),
        }))
        .filter((program) => program.memberId === memberViewId),
    [programs, memberViewId],
  );

  const memberWorkoutCommentAlerts = useMemo(
    () =>
      logs
        .filter((log) => log.memberId === memberViewId)
        .filter((log) => isCompletedWorkoutLog(log))
        .filter((log) => String(log.trainerComment ?? "").trim())
        .map((log, index) => {
          const updatedAt = String(log.trainerCommentUpdatedAt ?? "").trim();
          const timestamp = updatedAt ? parseTimestamp(updatedAt, index + 1) : index + 1;
          const comment = String(log.trainerComment ?? "").trim();
          const authorName = String(log.trainerCommentAuthorName ?? "").trim();
          const seenKey = `${log.id}:${updatedAt || comment}`;
          return {
            id: `member-workout-comment-${log.id}`,
            kind: "workout-comment" as const,
            title: "Ny kommentar på økten",
            text: log.programTitle,
            detail:
              comment.length > 72
                ? `${comment.slice(0, 72)}...`
                : `${authorName ? `${authorName}: ` : ""}${comment}`,
            timestamp,
            targetTab: "programs" as const,
            unread: !seenMemberWorkoutCommentKeys.includes(seenKey),
            seenKey,
            workoutLogId: log.id,
          };
        }),
    [logs, memberViewId, seenMemberWorkoutCommentKeys],
  );

  const memberTrainerMessages = useMemo(
    () =>
      messages
        .map((message, index) => ({
          ...message,
          _effectiveTimestamp: parseTimestamp(message.createdAt, index + 1),
        }))
        .filter((message) => message.memberId === memberViewId && message.sender === "trainer"),
    [messages, memberViewId],
  );

  const memberMessageAlerts = useMemo(
    () =>
      memberTrainerMessages.map((message) => ({
        id: `member-msg-${message.id}`,
        kind: "message" as const,
        title: "Ny melding fra trener",
        text: "Åpne meldinger",
        detail: message.text.length > 72 ? `${message.text.slice(0, 72)}...` : message.text,
        timestamp: message._effectiveTimestamp,
        targetTab: "messages" as const,
        unread: message._effectiveTimestamp > memberAlertsSeenAt,
      })),
    [memberTrainerMessages, memberAlertsSeenAt],
  );

  const memberProgramAlerts = useMemo(
    () =>
      dedupeTrainingPrograms(memberPrograms)
        .filter((program) => program.programCreatedBy !== "member")
        .filter((program) => !programIsInMemberArchive(program.memberLibraryStatus))
        .map((program) => ({
          id: `member-program-${program.id}`,
          kind: "program" as const,
          title: "Nytt treningsprogram",
          text: program.title,
          detail: program.goal || "Programmet er klart i Trening.",
          timestamp: program._effectiveTimestamp,
          targetTab: "programs" as const,
          unread: !seenMemberProgramIds.includes(program.id),
          programId: program.id,
        })),
    [memberPrograms, seenMemberProgramIds],
  );

  const memberCheckInAlert = useMemo(() => {
    if (!activeMember || currentUserRole !== "member") return null;
    if (!shouldPromptMonthlyCheckIn(activeMember, currentUserRole)) return null;
    const window = resolveCheckInWindow();
    if (!window) return null;
    const copy = buildCheckInNotificationCopy(window);
    return {
      id: `member-check-in-${window.monthKey}`,
      kind: "check-in" as const,
      title: copy.title,
      text: copy.text,
      detail: copy.detail,
      timestamp: window.opensAt.getTime(),
      targetTab: "overview" as const,
      unread: !dismissedMemberCheckInMonths.includes(window.monthKey),
    };
  }, [activeMember, currentUserRole, dismissedMemberCheckInMonths]);

  const memberPeriodPlanAlerts = useMemo(
    () => {
      const seenPlanIds = new Set<string>();
      return remoteMemberPeriodPlanRows
        .filter((row) => row.memberId === memberViewId)
        .map((row) => row.plan)
        .filter((plan) => plan.periodPlanAddedBy !== "member")
        .filter((plan) => plan.memberPeriodPlanStatus !== "hidden")
        .filter((plan) => {
          if (seenPlanIds.has(plan.id)) return false;
          seenPlanIds.add(plan.id);
          return true;
        })
        .map((plan, index) => {
          const seenKey = memberPeriodPlanSeenKey(plan);
          return {
            id: `member-period-plan-${plan.id}`,
            kind: "period-plan" as const,
            title: "Ny periodeplan",
            text: plan.title,
            detail: plan.notes?.trim() || "Planen er klar under Oversikt.",
            timestamp: periodPlanAlertTimestamp(plan, index + 1),
            targetTab: "overview" as const,
            unread: !seenMemberPeriodPlanKeys.includes(seenKey),
            seenKey,
          };
        });
    },
    [remoteMemberPeriodPlanRows, memberViewId, seenMemberPeriodPlanKeys],
  );

  const memberInspirationBaselineAt = readMemberInspirationBaselineAt();
  const memberInspirationAlerts = useMemo(
    () =>
      inspirationItems.map((item, index) => {
        const copy = buildInspirationNotificationAlertCopy(item);
        const timestamp = parseInspirationNotificationTimestamp(item) || parseTimestamp(item.createdAt, index + 1);
        return {
          id: `member-inspiration-${item.id}`,
          kind: "inspiration" as const,
          title: copy.title,
          text: copy.text,
          detail: copy.detail,
          timestamp,
          targetTab: "inspiration" as const,
          unread:
            timestamp > memberInspirationBaselineAt && !seenMemberInspirationIds.includes(item.id),
          inspirationItemId: item.id,
        };
      }),
    [inspirationItems, seenMemberInspirationIds, memberInspirationBaselineAt],
  );

  useEffect(() => {
    const logIdFromUrl = readWorkoutLogIdFromLocation();
    if (!logIdFromUrl) return;
    setMemberFocusWorkoutLogId(logIdFromUrl);
    setMemberTab("programs");
    stripWorkoutLogIdFromLocation();
  }, [setMemberTab]);

  useEffect(() => {
    const tabFromUrl = readMemberTabFromLocation();
    if (!tabFromUrl) return;
    setMemberTab(tabFromUrl);
    stripMemberTabFromLocation();
  }, [setMemberTab]);

  const memberRecentAlerts = useMemo<MemberAlert[]>(() => {
    const combined: MemberAlert[] = [
      ...(memberCheckInAlert
        ? [
            {
              id: memberCheckInAlert.id,
              kind: memberCheckInAlert.kind,
              title: memberCheckInAlert.title,
              text: memberCheckInAlert.text,
              detail: memberCheckInAlert.detail,
              timestamp: memberCheckInAlert.timestamp,
              targetTab: memberCheckInAlert.targetTab,
              isUnread: memberCheckInAlert.unread,
              isOpened: openedMemberAlertIds.includes(memberCheckInAlert.id),
            },
          ]
        : []),
      ...memberMessageAlerts.map((alert) => ({
        id: alert.id,
        kind: alert.kind,
        title: alert.title,
        text: alert.text,
        detail: alert.detail,
        timestamp: alert.timestamp,
        targetTab: alert.targetTab,
        isUnread: alert.unread,
        isOpened: openedMemberAlertIds.includes(alert.id),
      })),
      ...memberProgramAlerts.map((alert) => ({
        id: alert.id,
        kind: alert.kind,
        title: alert.title,
        text: alert.text,
        detail: alert.detail,
        timestamp: alert.timestamp,
        targetTab: alert.targetTab,
        isUnread: alert.unread,
        isOpened: openedMemberAlertIds.includes(alert.id),
      })),
      ...memberWorkoutCommentAlerts.map((alert) => ({
        id: alert.id,
        kind: alert.kind,
        title: alert.title,
        text: alert.text,
        detail: alert.detail,
        timestamp: alert.timestamp,
        targetTab: alert.targetTab,
        isUnread: alert.unread,
        isOpened: openedMemberAlertIds.includes(alert.id),
      })),
      ...memberInspirationAlerts.map((alert) => ({
        id: alert.id,
        kind: alert.kind,
        title: alert.title,
        text: alert.text,
        detail: alert.detail,
        timestamp: alert.timestamp,
        targetTab: alert.targetTab,
        isUnread: alert.unread,
        isOpened: openedMemberAlertIds.includes(alert.id),
      })),
      ...memberPeriodPlanAlerts.map((alert) => ({
        id: alert.id,
        kind: alert.kind,
        title: alert.title,
        text: alert.text,
        detail: alert.detail,
        timestamp: alert.timestamp,
        targetTab: alert.targetTab,
        isUnread: alert.unread,
        isOpened: openedMemberAlertIds.includes(alert.id),
      })),
    ];
    return sortAlertsForDisplay(combined.filter((alert) => alert.isUnread)).slice(0, ALERT_HISTORY_LIMIT);
  }, [
    memberMessageAlerts,
    memberProgramAlerts,
    memberWorkoutCommentAlerts,
    memberInspirationAlerts,
    memberPeriodPlanAlerts,
    memberCheckInAlert,
    openedMemberAlertIds,
  ]);

  const memberUnreadAlerts = useMemo(
    () => memberRecentAlerts.filter((alert) => alert.isUnread),
    [memberRecentAlerts],
  );

  const trainerUnreadAlerts = useMemo(
    () => trainerRecentAlerts.filter((alert) => alert.isUnread),
    [trainerRecentAlerts],
  );
  const trainerUnreadCount = trainerUnreadAlerts.length;
  const memberUnreadCount = memberUnreadAlerts.length;

  function markMemberInspirationAsSeen() {
    setSeenMemberInspirationIds((prev) => Array.from(new Set([...prev, ...inspirationItems.map((item) => item.id)])));
  }

  function handleTrainerBellToggle() {
    setTrainerNotificationsOpen((open) => !open);
  }

  function openTrainerAlert(alert: TrainerAlert) {
    setOpenedTrainerAlertIds((prev) => Array.from(new Set([...prev, alert.id])));

    if (alert.kind === "message") {
      setTrainerAlertsSeenAt((prev) => Math.max(prev, alert.timestamp));
      if (alert.memberId) {
        onTrainerOpenMessage?.(alert.memberId);
      }
    } else if (alert.kind === "member-form") {
      setSeenTrainerMemberFormKeys((prev) => Array.from(new Set([...prev, alert.id])));
      if (alert.memberId) {
        onTrainerOpenMemberForm?.(alert.memberId);
      } else {
        onTrainerOpenCustomers?.();
      }
    } else {
      setSeenTrainerOperationalAlertKey(trainerOperationalAlertKey);
      onTrainerOpenCustomers?.();
    }

    setTrainerNotificationsOpen(false);
  }

  function handleMemberBellToggle() {
    setMemberNotificationsOpen((open) => !open);
  }

  const markAllTrainerAlertsAsRead = useCallback(() => {
    if (!trainerUnreadAlerts.length) return;

    let nextTrainerAlertsSeenAt = trainerAlertsSeenAt;
    const nextOpenedIds = new Set(openedTrainerAlertIds);
    const nextMemberFormKeys = new Set(seenTrainerMemberFormKeys);

    for (const alert of trainerUnreadAlerts) {
      nextOpenedIds.add(alert.id);
      if (alert.kind === "message") {
        nextTrainerAlertsSeenAt = Math.max(nextTrainerAlertsSeenAt, alert.timestamp);
      } else if (alert.kind === "member-form") {
        nextMemberFormKeys.add(alert.id);
      }
    }

    setTrainerAlertsSeenAt(nextTrainerAlertsSeenAt);
    setOpenedTrainerAlertIds(Array.from(nextOpenedIds));
    setSeenTrainerMemberFormKeys(Array.from(nextMemberFormKeys));
    setSeenTrainerOperationalAlertKey(trainerOperationalAlertKey);
  }, [
    openedTrainerAlertIds,
    seenTrainerMemberFormKeys,
    trainerAlertsSeenAt,
    trainerOperationalAlertKey,
    trainerUnreadAlerts,
  ]);

  const markAllMemberAlertsAsRead = useCallback(() => {
    if (!memberUnreadAlerts.length) return;

    let nextMemberAlertsSeenAt = memberAlertsSeenAt;
    const nextOpenedIds = new Set(openedMemberAlertIds);
    const nextProgramIds = new Set(seenMemberProgramIds);
    const nextWorkoutCommentKeys = new Set(seenMemberWorkoutCommentKeys);
    const nextInspirationIds = new Set(seenMemberInspirationIds);
    const nextPeriodPlanKeys = new Set(seenMemberPeriodPlanKeys);
    const nextDismissedCheckInMonths = new Set(dismissedMemberCheckInMonths);

    for (const alert of memberUnreadAlerts) {
      nextOpenedIds.add(alert.id);
      if (alert.kind === "message") {
        nextMemberAlertsSeenAt = Math.max(nextMemberAlertsSeenAt, alert.timestamp);
      } else if (alert.kind === "program") {
        const programId = alert.id.replace(/^member-program-/, "");
        if (programId) nextProgramIds.add(programId);
      } else if (alert.kind === "workout-comment") {
        const workoutAlert = memberWorkoutCommentAlerts.find((item) => item.id === alert.id);
        if (workoutAlert?.seenKey) nextWorkoutCommentKeys.add(workoutAlert.seenKey);
      } else if (alert.kind === "inspiration") {
        const inspirationId = alert.inspirationItemId ?? alert.id.replace(/^member-inspiration-/, "");
        if (inspirationId) nextInspirationIds.add(inspirationId);
      } else if (alert.kind === "check-in") {
        const monthKey = alert.id.replace(/^member-check-in-/, "");
        if (monthKey) nextDismissedCheckInMonths.add(monthKey);
      } else if (alert.kind === "period-plan") {
        const periodAlert = memberPeriodPlanAlerts.find((item) => item.id === alert.id);
        if (periodAlert?.seenKey) nextPeriodPlanKeys.add(periodAlert.seenKey);
      }
    }

    setMemberAlertsSeenAt(nextMemberAlertsSeenAt);
    setOpenedMemberAlertIds(Array.from(nextOpenedIds));
    setSeenMemberProgramIds(Array.from(nextProgramIds));
    setSeenMemberWorkoutCommentKeys(Array.from(nextWorkoutCommentKeys));
    setSeenMemberInspirationIds(Array.from(nextInspirationIds));
    setSeenMemberPeriodPlanKeys(Array.from(nextPeriodPlanKeys));
    setDismissedMemberCheckInMonths(Array.from(nextDismissedCheckInMonths));
  }, [
    dismissedMemberCheckInMonths,
    memberAlertsSeenAt,
    memberPeriodPlanAlerts,
    memberUnreadAlerts,
    memberWorkoutCommentAlerts,
    openedMemberAlertIds,
    seenMemberInspirationIds,
    seenMemberPeriodPlanKeys,
    seenMemberProgramIds,
    seenMemberWorkoutCommentKeys,
  ]);

  function openAlert(alert: MemberAlert) {
    if (alert.kind === "message") {
      setMemberAlertsSeenAt((prev) => Math.max(prev, alert.timestamp));
      setOpenedMemberAlertIds((prev) => Array.from(new Set([...prev, alert.id])));
    } else if (alert.kind === "program") {
      const programId = alert.id.replace(/^member-program-/, "");
      if (programId) {
        setSeenMemberProgramIds((prev) => Array.from(new Set([...prev, programId])));
        setOpenedMemberAlertIds((prev) => Array.from(new Set([...prev, alert.id])));
        setMemberFocusProgramId(programId);
      }
    } else if (alert.kind === "workout-comment") {
      const workoutAlert = memberWorkoutCommentAlerts.find((item) => item.id === alert.id);
      if (workoutAlert?.seenKey) {
        setSeenMemberWorkoutCommentKeys((prev) => Array.from(new Set([...prev, workoutAlert.seenKey])));
      }
      setOpenedMemberAlertIds((prev) => Array.from(new Set([...prev, alert.id])));
      const logId = workoutAlert?.workoutLogId ?? workoutLogIdFromMemberAlertId(alert.id);
      if (logId) {
        setMemberFocusWorkoutLogId(logId);
      }
    } else if (alert.kind === "inspiration") {
      const inspirationId = alert.inspirationItemId ?? alert.id.replace(/^member-inspiration-/, "");
      if (inspirationId) {
        setSeenMemberInspirationIds((prev) => Array.from(new Set([...prev, inspirationId])));
        setOpenedMemberAlertIds((prev) => Array.from(new Set([...prev, alert.id])));
        setMemberFocusInspirationItemId(inspirationId);
      }
    } else if (alert.kind === "check-in") {
      const monthKey = alert.id.replace(/^member-check-in-/, "");
      if (monthKey) {
        setDismissedMemberCheckInMonths((prev) => Array.from(new Set([...prev, monthKey])));
      }
      setOpenedMemberAlertIds((prev) => Array.from(new Set([...prev, alert.id])));
      setMemberCheckInOverlayOpen(true);
    } else if (alert.kind === "period-plan") {
      const periodAlert = memberPeriodPlanAlerts.find((item) => item.id === alert.id);
      if (periodAlert?.seenKey) {
        setSeenMemberPeriodPlanKeys((prev) => Array.from(new Set([...prev, periodAlert.seenKey])));
      }
      setOpenedMemberAlertIds((prev) => Array.from(new Set([...prev, alert.id])));
    }

    setMemberTab(alert.targetTab);
    setMemberNotificationsOpen(false);
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("motus.notifications.trainerSeenAt", String(trainerAlertsSeenAt));
  }, [trainerAlertsSeenAt]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("motus.notifications.memberSeenAt", String(memberAlertsSeenAt));
  }, [memberAlertsSeenAt]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("motus.notifications.memberSeenProgramIds", JSON.stringify(seenMemberProgramIds));
  }, [seenMemberProgramIds]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      "motus.notifications.memberSeenWorkoutCommentKeys",
      JSON.stringify(seenMemberWorkoutCommentKeys),
    );
  }, [seenMemberWorkoutCommentKeys]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("motus.notifications.memberOpenedAlertIds", JSON.stringify(openedMemberAlertIds));
  }, [openedMemberAlertIds]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("motus.notifications.trainerOpenedAlertIds", JSON.stringify(openedTrainerAlertIds));
  }, [openedTrainerAlertIds]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("motus.notifications.trainerOperationalSeenKey", seenTrainerOperationalAlertKey);
  }, [seenTrainerOperationalAlertKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("motus.notifications.memberSeenInspirationIds", JSON.stringify(seenMemberInspirationIds));
  }, [seenMemberInspirationIds]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("motus.notifications.memberSeenPeriodPlanKeys", JSON.stringify(seenMemberPeriodPlanKeys));
  }, [seenMemberPeriodPlanKeys]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("motus.notifications.trainerSeenMemberFormKeys", JSON.stringify(seenTrainerMemberFormKeys));
  }, [seenTrainerMemberFormKeys]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      "motus.notifications.memberDismissedCheckInMonths",
      JSON.stringify(dismissedMemberCheckInMonths),
    );
  }, [dismissedMemberCheckInMonths]);

  useLayoutEffect(() => {
    if (!isMemberSession) {
      memberPrefsHydratedRef.current = false;
      memberCloudPrefsSyncedRef.current = false;
      lastMergedMemberPersonalGoalsRef.current = undefined;
      return;
    }
    if (!memberProfileReady) {
      memberPrefsHydratedRef.current = false;
      memberCloudPrefsSyncedRef.current = false;
      return;
    }
    if (lastMergedMemberPersonalGoalsRef.current === memberPersonalGoals) {
      memberPrefsHydratedRef.current = true;
      return;
    }
    lastMergedMemberPersonalGoalsRef.current = memberPersonalGoals;
    const remote = readMemberNotificationPreferencesFromPersonalGoals(memberPersonalGoals);
    const localBase = memberCloudPrefsSyncedRef.current
      ? buildMemberNotificationSnapshotRef.current()
      : emptyMemberNotificationPreferences();
    const merged = mergeMemberNotificationPreferences(localBase, remote);
    applyMemberNotificationSnapshot(merged);
    lastPersistedMemberPrefsRef.current = JSON.stringify(merged);
    memberPrefsHydratedRef.current = true;
    memberCloudPrefsSyncedRef.current = true;
  }, [applyMemberNotificationSnapshot, isMemberSession, memberPersonalGoals, memberProfileReady]);

  useEffect(() => {
    if (!isMemberSession || !onPersistMemberNotificationPreferences) return;
    if (!memberProfileReady || !memberPrefsHydratedRef.current) return;
    if (skipMemberPersistRef.current) return;
    const timer = window.setTimeout(() => {
      const snapshot = buildMemberNotificationSnapshot();
      const serialized = JSON.stringify(snapshot);
      if (serialized === lastPersistedMemberPrefsRef.current) return;
      lastPersistedMemberPrefsRef.current = serialized;
      onPersistMemberNotificationPreferences(snapshot);
    }, 700);
    return () => window.clearTimeout(timer);
  }, [
    buildMemberNotificationSnapshot,
    currentUserRole,
    dismissedMemberCheckInMonths,
    memberAlertsSeenAt,
    onPersistMemberNotificationPreferences,
    openedMemberAlertIds,
    seenMemberInspirationIds,
    seenMemberPeriodPlanKeys,
    seenMemberProgramIds,
    seenMemberWorkoutCommentKeys,
  ]);

  const pullTrainerNotificationPreferences = useCallback(async (options?: { isCancelled?: () => boolean }) => {
    const isCancelled = () => options?.isCancelled?.() ?? false;
    if (currentUserRole !== "trainer") {
      trainerPrefsHydratedRef.current = false;
      return;
    }
    if (!isSupabaseConfigured || !supabaseClient) {
      trainerPrefsHydratedRef.current = true;
      return;
    }
    const { data, error } = await supabaseClient.auth.getSession();
    if (isCancelled()) return;
    if (error || !data.session?.user) {
      trainerPrefsHydratedRef.current = true;
      seedTrainerNotificationsBaseline();
      return;
    }
    const remote = readTrainerNotificationPreferencesFromUserMetadata(
      data.session.user.user_metadata as Record<string, unknown> | undefined,
    );
    if (remote && remote.updatedAt <= lastMergedTrainerRemoteUpdatedAtRef.current) {
      trainerPrefsHydratedRef.current = true;
      return;
    }
    if (remote) {
      lastMergedTrainerRemoteUpdatedAtRef.current = remote.updatedAt;
    }
    const localBase = trainerPrefsHydratedRef.current
      ? buildTrainerNotificationSnapshot()
      : emptyTrainerNotificationPreferences();
    const merged = mergeTrainerNotificationPreferences(localBase, remote);
    if (isCancelled()) return;
    applyTrainerNotificationSnapshot(merged);
    lastPersistedTrainerPrefsRef.current = JSON.stringify(merged);
    trainerPrefsHydratedRef.current = true;
    if (!remote) {
      seedTrainerNotificationsBaseline();
    }
  }, [
    applyTrainerNotificationSnapshot,
    buildTrainerNotificationSnapshot,
    currentUserRole,
    members,
    messages,
    seedTrainerNotificationsBaseline,
    trainerOperationalAlertKey,
  ]);

  useLayoutEffect(() => {
    if (currentUserRole !== "trainer") {
      trainerPrefsHydratedRef.current = false;
      trainerBaselineSeedAppliedRef.current = false;
      return;
    }
    if (!isSupabaseConfigured || !supabaseClient) {
      trainerPrefsHydratedRef.current = true;
      seedTrainerNotificationsBaseline();
    }
  }, [currentUserRole, members, messages, seedTrainerNotificationsBaseline]);

  useEffect(() => {
    if (currentUserRole !== "trainer" || !isSupabaseConfigured || !supabaseClient) return;
    let cancelled = false;
    const runPull = () => pullTrainerNotificationPreferences({ isCancelled: () => cancelled });
    void runPull();
    const onVisible = () => {
      if (document.visibilityState === "visible") void runPull();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", runPull);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", runPull);
    };
  }, [currentUserRole, pullTrainerNotificationPreferences]);

  useEffect(() => {
    if (currentUserRole !== "trainer" || !isSupabaseConfigured || !supabaseClient) return;
    if (!trainerPrefsHydratedRef.current) return;
    if (skipTrainerPersistRef.current) return;
    const timer = window.setTimeout(() => {
      const snapshot = buildTrainerNotificationSnapshot();
      const serialized = JSON.stringify(snapshot);
      if (serialized === lastPersistedTrainerPrefsRef.current) return;
      lastPersistedTrainerPrefsRef.current = serialized;
      void supabaseClient.auth.updateUser({
        data: { [TRAINER_NOTIFICATION_PREFS_METADATA_KEY]: snapshot },
      });
    }, 700);
    return () => window.clearTimeout(timer);
  }, [
    buildTrainerNotificationSnapshot,
    currentUserRole,
    openedTrainerAlertIds,
    seenTrainerMemberFormKeys,
    seenTrainerOperationalAlertKey,
    trainerAlertsSeenAt,
    trainerNotificationsBaselineAt,
  ]);

  const clearMemberFocusInspirationItemId = useCallback(() => setMemberFocusInspirationItemId(null), []);
  const clearMemberFocusWorkoutLogId = useCallback(() => setMemberFocusWorkoutLogId(null), []);
  const clearMemberFocusProgramId = useCallback(() => setMemberFocusProgramId(null), []);

  return {
    trainerNotificationsOpen,
    setTrainerNotificationsOpen,
    memberNotificationsOpen,
    trainerVisibleAlerts: trainerRecentAlerts,
    memberVisibleAlerts: memberRecentAlerts,
    trainerUnreadCount,
    memberUnreadCount,
    handleTrainerBellToggle,
    handleMemberBellToggle,
    markAllTrainerAlertsAsRead,
    markAllMemberAlertsAsRead,
    openTrainerAlert,
    openAlert,
    markMemberInspirationAsSeen,
    memberFocusInspirationItemId,
    clearMemberFocusInspirationItemId,
    memberFocusWorkoutLogId,
    clearMemberFocusWorkoutLogId,
    memberFocusProgramId,
    clearMemberFocusProgramId,
    memberCheckInOverlayOpen,
    setMemberCheckInOverlayOpen,
  };
}
