import { useEffect, useMemo, useState } from "react";
import type { ChatMessage, Member, MemberTab, TrainingProgram } from "./types";

type MemberAlert = {
  id: string;
  text: string;
  timestamp: number;
  targetTab: "messages" | "programs";
};

type TrainerAlert = {
  id: string;
  memberId: string;
  text: string;
  timestamp: number;
};

function parseTimestamp(value: string, fallbackOrder: number): number {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : fallbackOrder;
}

export function useNotifications({
  messages,
  programs,
  members,
  memberViewId,
  setMemberTab,
}: {
  messages: ChatMessage[];
  programs: TrainingProgram[];
  members: Member[];
  memberViewId: string;
  setMemberTab: (tab: MemberTab) => void;
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
  const [memberVisibleAlerts, setMemberVisibleAlerts] = useState<MemberAlert[]>([]);

  const memberById = useMemo(() => new Map(members.map((member) => [member.id, member])), [members]);

  const trainerMessageAlerts = useMemo<TrainerAlert[]>(() => {
    const latestByMember = new Map<string, { message: ChatMessage; timestamp: number }>();
    messages
      .filter((message) => message.sender === "member")
      .forEach((message, index) => {
        const timestamp = parseTimestamp(message.createdAt, index + 1);
        const previous = latestByMember.get(message.memberId);
        if (!previous || timestamp > previous.timestamp) {
          latestByMember.set(message.memberId, { message, timestamp });
        }
      });

    return Array.from(latestByMember.values())
      .sort((a, b) => b.timestamp - a.timestamp)
      .map(({ message, timestamp }) => {
        const member = memberById.get(message.memberId);
        const name = member?.name || "Et medlem";
        return {
          id: `msg-${message.id}`,
          memberId: message.memberId,
          text: `${name} har sendt deg en ny melding`,
          timestamp,
        };
      });
  }, [messages, memberById]);

  const memberPrograms = useMemo(
    () =>
      programs
        .map((program, index) => ({
          ...program,
          _effectiveTimestamp: parseTimestamp(program.createdAt, index + 1),
        }))
        .filter((program) => program.memberId === memberViewId),
    [programs, memberViewId]
  );

  const memberTrainerMessages = useMemo(
    () =>
      messages
        .map((message, index) => ({
          ...message,
          _effectiveTimestamp: parseTimestamp(message.createdAt, index + 1),
        }))
        .filter((message) => message.memberId === memberViewId && message.sender === "trainer"),
    [messages, memberViewId]
  );

  const memberMessageAlerts = useMemo<MemberAlert[]>(
    () =>
      memberTrainerMessages.map((message) => ({
        id: `member-msg-${message.id}`,
        text: "Ny melding fra trener",
        timestamp: message._effectiveTimestamp,
        targetTab: "messages",
      })),
    [memberTrainerMessages]
  );

  const memberProgramAlerts = useMemo(
    () =>
      memberPrograms.map((program) => ({
        id: `member-program-${program.id}`,
        text: `Du har fått nytt treningsprogram: ${program.title}`,
        timestamp: program._effectiveTimestamp,
        targetTab: "programs" as const,
        unread: !seenMemberProgramIds.includes(program.id),
      })),
    [memberPrograms, seenMemberProgramIds]
  );

  const memberUnreadAlerts = useMemo(
    () =>
      [...memberMessageAlerts, ...memberProgramAlerts]
        .filter((alert) => ("unread" in alert ? alert.unread : alert.timestamp > memberAlertsSeenAt))
        .sort((a, b) => b.timestamp - a.timestamp),
    [memberMessageAlerts, memberProgramAlerts, memberAlertsSeenAt]
  );

  const trainerUnreadCount = useMemo(
    () => trainerMessageAlerts.filter((alert) => alert.timestamp > trainerAlertsSeenAt).length,
    [trainerMessageAlerts, trainerAlertsSeenAt]
  );
  const memberUnreadCount = memberUnreadAlerts.length;

  function handleTrainerBellToggle() {
    const willOpen = !trainerNotificationsOpen;
    setTrainerNotificationsOpen(willOpen);
    if (willOpen) {
      const latestAlertTime = trainerMessageAlerts.reduce((max, alert) => Math.max(max, alert.timestamp), 0);
      setTrainerAlertsSeenAt(latestAlertTime);
    }
  }

  function handleMemberBellToggle() {
    const willOpen = !memberNotificationsOpen;
    setMemberNotificationsOpen(willOpen);
    if (willOpen) {
      setMemberVisibleAlerts(memberUnreadAlerts);
      const latestAlertTime = [...memberMessageAlerts, ...memberProgramAlerts].reduce(
        (max, alert) => Math.max(max, alert.timestamp),
        0
      );
      setMemberAlertsSeenAt(latestAlertTime);
      setSeenMemberProgramIds((prev) => Array.from(new Set([...prev, ...memberPrograms.map((program) => program.id)])));
      return;
    }
    setMemberVisibleAlerts([]);
  }

  function openAlert(alert: MemberAlert) {
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

  return {
    trainerNotificationsOpen,
    setTrainerNotificationsOpen,
    memberNotificationsOpen,
    trainerMessageAlerts,
    memberVisibleAlerts,
    trainerUnreadCount,
    memberUnreadCount,
    handleTrainerBellToggle,
    handleMemberBellToggle,
    openAlert,
  };
}
