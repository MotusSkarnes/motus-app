import { useEffect, useMemo, useState } from "react";
import { trainerInactiveDaysForFollowUp } from "./memberActivity";
import type { ChatMessage, Member, MemberTab, TrainingProgram, WorkoutLog } from "./types";

const ALERT_HISTORY_LIMIT = 5;
const TRAINER_OPERATIONAL_TIMESTAMP_BASE = 9_000_000_000_000;

export type MemberAlert = {
  id: string;
  kind: "message" | "program" | "workout-comment";
  title: string;
  text: string;
  detail: string;
  timestamp: number;
  targetTab: "messages" | "programs" | "progress";
  isUnread: boolean;
  isOpened: boolean;
};

export type TrainerAlert = {
  id: string;
  kind: "message" | "missing-invite" | "inactive-member";
  memberId: string;
  title: string;
  text: string;
  detail: string;
  timestamp: number;
  isUnread: boolean;
  isOpened: boolean;
};

function parseTimestamp(value: string, fallbackOrder: number): number {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : fallbackOrder;
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
  setMemberTab,
  onTrainerOpenMessage,
  onTrainerOpenCustomers,
}: {
  messages: ChatMessage[];
  programs: TrainingProgram[];
  logs: WorkoutLog[];
  members: Member[];
  memberViewId: string;
  setMemberTab: (tab: MemberTab) => void;
  onTrainerOpenMessage?: (memberId: string) => void;
  onTrainerOpenCustomers?: () => void;
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

  const memberById = useMemo(() => new Map(members.map((member) => [member.id, member])), [members]);

  const missingInviteMemberIds = useMemo(
    () => members.filter((member) => !member.invitedAt?.trim()).map((member) => member.id).sort(),
    [members],
  );
  const inactiveMemberIds = useMemo(
    () =>
      members
        .filter((member) => (trainerInactiveDaysForFollowUp(member, members, logs) ?? -1) >= 7)
        .map((member) => member.id)
        .sort(),
    [members, logs],
  );
  const trainerOperationalAlertKey = `${missingInviteMemberIds.join(",")}|${inactiveMemberIds.join(",")}`;
  const hasTrainerOperationalAlerts = missingInviteMemberIds.length + inactiveMemberIds.length > 0;
  const trainerOperationalUnread = hasTrainerOperationalAlerts && trainerOperationalAlertKey !== seenTrainerOperationalAlertKey;

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
    return combined.sort((a, b) => b.timestamp - a.timestamp).slice(0, ALERT_HISTORY_LIMIT);
  }, [trainerMessageAlerts, trainerOperationalAlerts, openedTrainerAlertIds]);

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
            targetTab: "progress" as const,
            unread: !seenMemberWorkoutCommentKeys.includes(seenKey),
            seenKey,
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

  const memberRecentAlerts = useMemo<MemberAlert[]>(() => {
    const combined: MemberAlert[] = [
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
    ];
    return combined.sort((a, b) => b.timestamp - a.timestamp).slice(0, ALERT_HISTORY_LIMIT);
  }, [memberMessageAlerts, memberProgramAlerts, memberWorkoutCommentAlerts, openedMemberAlertIds]);

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

  function markTrainerAlertsAsSeen() {
    const latestMessageTime = trainerMessageAlerts.reduce((max, alert) => Math.max(max, alert.timestamp), 0);
    setTrainerAlertsSeenAt(latestMessageTime);
    if (hasTrainerOperationalAlerts) {
      setSeenTrainerOperationalAlertKey(trainerOperationalAlertKey);
    }
  }

  function markMemberAlertsAsSeen() {
    const latestAlertTime = [...memberMessageAlerts, ...memberProgramAlerts, ...memberWorkoutCommentAlerts].reduce(
      (max, alert) => Math.max(max, alert.timestamp),
      0,
    );
    setMemberAlertsSeenAt(latestAlertTime);
    setSeenMemberProgramIds((prev) => Array.from(new Set([...prev, ...memberPrograms.map((program) => program.id)])));
    setSeenMemberWorkoutCommentKeys((prev) =>
      Array.from(new Set([...prev, ...memberWorkoutCommentAlerts.map((alert) => alert.seenKey)])),
    );
  }

  function handleTrainerBellToggle() {
    const willOpen = !trainerNotificationsOpen;
    setTrainerNotificationsOpen(willOpen);
    if (willOpen) {
      markTrainerAlertsAsSeen();
    }
  }

  function openTrainerAlert(alert: TrainerAlert) {
    setOpenedTrainerAlertIds((prev) => Array.from(new Set([...prev, alert.id])));

    if (alert.kind === "message") {
      setTrainerAlertsSeenAt((prev) => Math.max(prev, alert.timestamp));
      if (alert.memberId) {
        onTrainerOpenMessage?.(alert.memberId);
      }
    } else {
      setSeenTrainerOperationalAlertKey(trainerOperationalAlertKey);
      onTrainerOpenCustomers?.();
    }

    setTrainerNotificationsOpen(false);
  }

  function handleMemberBellToggle() {
    const willOpen = !memberNotificationsOpen;
    setMemberNotificationsOpen(willOpen);
    if (willOpen) {
      markMemberAlertsAsSeen();
    }
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
  };
}
