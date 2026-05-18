import { useCallback, useEffect, useMemo, useState } from "react";
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
import { buildMemberFormTrainerAlerts } from "./memberFormTrainerAlerts";
import {
  buildCheckInNotificationCopy,
  resolveCheckInWindow,
  shouldPromptMonthlyCheckIn,
} from "./memberMonthlyCheckIn";
import { formatNotificationTimestamp } from "./dateFormat";
import { parseChatMessageCreatedAtMs } from "./messageHydrationMerge";
import type { ChatMessage, Member, MemberTab, TrainingProgram, WorkoutLog } from "./types";
import { readWorkoutLogIdFromLocation, stripWorkoutLogIdFromLocation, workoutLogIdFromMemberAlertId } from "./workoutLogDeepLink";

const MEMBER_INSPIRATION_BASELINE_KEY = "motus.notifications.memberInspirationBaselineAt";
const TRAINER_NOTIFICATIONS_BASELINE_KEY = "motus.notifications.trainerBaselineAt";

const ALERT_HISTORY_LIMIT = 5;
/** Operational varsler sorteres etter ekte hendelser når begge er uleste. */
const TRAINER_OPERATIONAL_TIMESTAMP_BASE = 1;

export type MemberAlert = {
  id: string;
  kind: "message" | "program" | "workout-comment" | "inspiration" | "check-in";
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

export function useNotifications({
  messages,
  programs,
  logs,
  members,
  memberViewId,
  currentUserRole,
  setMemberTab,
  onTrainerOpenMessage,
  onTrainerOpenCustomers,
  onTrainerOpenMemberForm,
}: {
  messages: ChatMessage[];
  programs: TrainingProgram[];
  logs: WorkoutLog[];
  members: Member[];
  memberViewId: string;
  currentUserRole?: "trainer" | "member";
  setMemberTab: (tab: MemberTab) => void;
  onTrainerOpenMessage?: (memberId: string) => void;
  onTrainerOpenCustomers?: () => void;
  onTrainerOpenMemberForm?: (memberId: string) => void;
}) {
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

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(MEMBER_INSPIRATION_BASELINE_KEY)) return;
    if (inspirationItems.length === 0) return;
    const baselineAt = Date.now();
    window.localStorage.setItem(MEMBER_INSPIRATION_BASELINE_KEY, String(baselineAt));
    setSeenMemberInspirationIds((prev) => Array.from(new Set([...prev, ...inspirationItems.map((item) => item.id)])));
  }, [inspirationItems]);

  const memberById = useMemo(() => new Map(members.map((member) => [member.id, member])), [members]);

  const activeMember = useMemo(
    () => (memberViewId ? memberById.get(memberViewId) ?? null : null),
    [memberById, memberViewId],
  );

  const rosterMembers = useMemo(() => members.filter((member) => member.isActive !== false), [members]);

  const missingInviteMemberIds = useMemo(
    () => rosterMembers.filter((member) => !member.invitedAt?.trim()).map((member) => member.id).sort(),
    [rosterMembers],
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
  const hasTrainerOperationalAlerts = missingInviteMemberIds.length + inactiveMemberIds.length > 0;
  const trainerOperationalUnread = hasTrainerOperationalAlerts && trainerOperationalAlertKey !== seenTrainerOperationalAlertKey;

  /** Ny PC/nettleser: marker eksisterende PT-varsler som sett uten å skjule fremtidige. */
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (currentUserRole !== "trainer") return;
    if (window.localStorage.getItem(TRAINER_NOTIFICATIONS_BASELINE_KEY)) return;
    if (members.length === 0 && messages.length === 0) return;

    const latestMemberMessageTime = messages
      .filter((message) => message.sender === "member")
      .reduce((max, message, index) => Math.max(max, parseTimestamp(message.createdAt, index + 1)), 0);

    window.localStorage.setItem(TRAINER_NOTIFICATIONS_BASELINE_KEY, String(Date.now()));
    setTrainerAlertsSeenAt((prev) => Math.max(prev, latestMemberMessageTime));
    setSeenTrainerOperationalAlertKey(trainerOperationalAlertKey);
  }, [currentUserRole, members, messages, trainerOperationalAlertKey]);

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
            unread: timestamp > trainerAlertsSeenAt,
          };
        }),
    [messages, memberById, trainerAlertsSeenAt],
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
        unread: true,
      })),
    [members, seenTrainerMemberFormKeys],
  );

  const trainerOperationalAlerts = useMemo<TrainerAlert[]>(() => {
    const alerts: TrainerAlert[] = [];
    if (missingInviteMemberIds.length > 0) {
      const id = "trainer-op-missing-invites";
      alerts.push({
        id,
        kind: "missing-invite",
        memberId: "",
        title: "Invitasjoner",
        text: `${missingInviteMemberIds.length} kunder mangler invitasjon`,
        detail: "Gå til klienter og send invitasjon.",
        timestamp: TRAINER_OPERATIONAL_TIMESTAMP_BASE,
        isUnread: trainerOperationalUnread,
        isOpened: openedTrainerAlertIds.includes(id),
      });
    }
    if (inactiveMemberIds.length > 0) {
      const id = "trainer-op-inactive-members";
      alerts.push({
        id,
        kind: "inactive-member",
        memberId: "",
        title: "Oppfølging",
        text: `${inactiveMemberIds.length} kunder bør følges opp`,
        detail: "Åpne klientlisten og prioriter oppfølging.",
        timestamp: TRAINER_OPERATIONAL_TIMESTAMP_BASE - 1,
        isUnread: trainerOperationalUnread,
        isOpened: openedTrainerAlertIds.includes(id),
      });
    }
    return alerts;
  }, [missingInviteMemberIds.length, inactiveMemberIds.length, trainerOperationalUnread, openedTrainerAlertIds]);

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
    return sortAlertsForDisplay(combined).slice(0, ALERT_HISTORY_LIMIT);
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
      memberPrograms
        .filter((program) => program.programCreatedBy !== "member")
        .filter((program) => !program.memberLibraryStatus)
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
      unread: true,
    };
  }, [activeMember, currentUserRole]);

  const memberInspirationAlerts = useMemo(
    () =>
      inspirationItems.map((item, index) => {
        const copy = buildInspirationNotificationAlertCopy(item);
        return {
          id: `member-inspiration-${item.id}`,
          kind: "inspiration" as const,
          title: copy.title,
          text: copy.text,
          detail: copy.detail,
          timestamp: parseInspirationNotificationTimestamp(item) || parseTimestamp(item.createdAt, index + 1),
          targetTab: "inspiration" as const,
          unread: !seenMemberInspirationIds.includes(item.id),
          inspirationItemId: item.id,
        };
      }),
    [inspirationItems, seenMemberInspirationIds],
  );

  useEffect(() => {
    const logIdFromUrl = readWorkoutLogIdFromLocation();
    if (!logIdFromUrl) return;
    setMemberFocusWorkoutLogId(logIdFromUrl);
    setMemberTab("programs");
    stripWorkoutLogIdFromLocation();
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
    ];
    return sortAlertsForDisplay(combined).slice(0, ALERT_HISTORY_LIMIT);
  }, [
    memberMessageAlerts,
    memberProgramAlerts,
    memberWorkoutCommentAlerts,
    memberInspirationAlerts,
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

  function openAlert(alert: MemberAlert) {
    setOpenedMemberAlertIds((prev) => Array.from(new Set([...prev, alert.id])));

    if (alert.kind === "message") {
      setMemberAlertsSeenAt((prev) => Math.max(prev, alert.timestamp));
    } else if (alert.kind === "program") {
      const programId = alert.id.replace(/^member-program-/, "");
      if (programId) {
        setSeenMemberProgramIds((prev) => Array.from(new Set([...prev, programId])));
      }
    } else if (alert.kind === "workout-comment") {
      const workoutAlert = memberWorkoutCommentAlerts.find((item) => item.id === alert.id);
      if (workoutAlert?.seenKey) {
        setSeenMemberWorkoutCommentKeys((prev) => Array.from(new Set([...prev, workoutAlert.seenKey])));
      }
      const logId = workoutAlert?.workoutLogId ?? workoutLogIdFromMemberAlertId(alert.id);
      if (logId) {
        setMemberFocusWorkoutLogId(logId);
      }
    } else if (alert.kind === "inspiration") {
      const inspirationId = alert.inspirationItemId ?? alert.id.replace(/^member-inspiration-/, "");
      if (inspirationId) {
        setSeenMemberInspirationIds((prev) => Array.from(new Set([...prev, inspirationId])));
        setMemberFocusInspirationItemId(inspirationId);
      }
    } else if (alert.kind === "check-in") {
      setMemberCheckInOverlayOpen(true);
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
    window.localStorage.setItem("motus.notifications.trainerSeenMemberFormKeys", JSON.stringify(seenTrainerMemberFormKeys));
  }, [seenTrainerMemberFormKeys]);

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
    openTrainerAlert,
    openAlert,
    markMemberInspirationAsSeen,
    memberFocusInspirationItemId,
    clearMemberFocusInspirationItemId: () => setMemberFocusInspirationItemId(null),
    memberFocusWorkoutLogId,
    clearMemberFocusWorkoutLogId: () => setMemberFocusWorkoutLogId(null),
    memberCheckInOverlayOpen,
    setMemberCheckInOverlayOpen,
  };
}
