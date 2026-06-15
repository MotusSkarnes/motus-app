import type { ChatMessage, Member, TrainingProgram, WorkoutLog } from "./types";
import type { TrainerFollowUpCardModel, TrainerTodayFeedItem } from "../features/TrainerHomeOverview";
import { parseChatCreatedAtMs } from "./chatFormat";
import { memberPriorityTone, trainerInactiveDaysForFollowUp } from "./memberActivity";
import { parseLogDateMs } from "./workoutLogDate";

export type TrainerPtHomeKpi = {
  id: string;
  label: string;
  value: string;
  delta: string;
  tone: "teal" | "pink" | "purple" | "green";
};

export type TrainerPtHomePlanItem = {
  id: string;
  timeLabel: string;
  title: string;
  clientName: string;
  avatarUrl: string | null;
  channelLabel: string;
  channelTone: "video" | "chat" | "center" | "program";
};

export type TrainerPtHomeAttentionClient = {
  memberId: string;
  memberName: string;
  avatarUrl: string | null;
  statusLabel: string;
  statusTone: "ready" | "message" | "inactive" | "waiting";
  lastActiveLabel: string;
};

export type TrainerPtHomePopularContent = {
  id: string;
  title: string;
  shareLabel: string;
  imageUrl?: string;
};

export type TrainerPtHomeProgressPoint = {
  label: string;
  value: number;
};

export function countProgramsCreatedThisWeek(programs: TrainingProgram[]): number {
  const now = Date.now();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  return programs.filter((program) => {
    if (program.memberId === "__template__") return false;
    const created = Date.parse(program.createdAt ?? "");
    return Number.isFinite(created) && now - created <= weekMs;
  }).length;
}

export function countInspirationPostsThisMonth(inspirationCount: number): number {
  return inspirationCount;
}

export function computeAverageClientProgressPct(members: Member[], allMembers: Member[], logs: WorkoutLog[]): number {
  const active = members.filter((member) => member.isActive !== false);
  if (!active.length) return 0;
  const green = active.filter((member) => {
    const days = trainerInactiveDaysForFollowUp(member, allMembers, logs);
    return days !== null && days < 5;
  }).length;
  return Math.round((green / active.length) * 100);
}

export function buildTrainerPtHomeKpis(input: {
  activeMemberCount: number;
  newMembersThisWeek: number;
  programsThisWeek: number;
  inspirationPostsMonth: number;
  averageProgressPct: number;
}): TrainerPtHomeKpi[] {
  return [
    {
      id: "clients",
      label: "Aktive klienter",
      value: String(input.activeMemberCount),
      delta: input.newMembersThisWeek > 0 ? `+${input.newMembersThisWeek} denne uken` : "Stabil uke",
      tone: "teal",
    },
    {
      id: "programs",
      label: "Programmer",
      value: String(input.programsThisWeek),
      delta: "Opprettet denne uken",
      tone: "pink",
    },
    {
      id: "posts",
      label: "Innlegg delt",
      value: String(input.inspirationPostsMonth),
      delta: "Denne måneden",
      tone: "purple",
    },
    {
      id: "progress",
      label: "Gj.sn. fremgang",
      value: `${input.averageProgressPct}%`,
      delta: "Hos dine klienter",
      tone: "green",
    },
  ];
}

export function buildTrainerPtHomePlanItems(
  feed: TrainerTodayFeedItem[],
  membersById: Map<string, Member>,
  resolveAvatar: (member: Member) => string | null,
): TrainerPtHomePlanItem[] {
  return feed.slice(0, 4).map((item) => {
    const memberName =
      item.subtitle?.includes("–") ? item.subtitle.split("–")[0]?.trim() ?? "" : item.title.replace(/^Følg opp /, "");
    const member =
      [...membersById.values()].find((row) => row.name.startsWith(memberName) || row.name === memberName) ?? null;
    const channel =
      item.tone === "workout"
        ? { label: "Senter", tone: "center" as const }
        : item.tone === "followup"
          ? { label: "Video", tone: "video" as const }
          : item.tone === "program"
            ? { label: "Program", tone: "program" as const }
            : { label: "Chat", tone: "chat" as const };
    return {
      id: item.id,
      timeLabel: item.timeLabel,
      title: item.title,
      clientName: member?.name.split(" ")[0] ?? memberName.split(" ")[0] ?? "Klient",
      avatarUrl: member ? resolveAvatar(member) : null,
      channelLabel: channel.label,
      channelTone: channel.tone,
    };
  });
}

function memberHasRecentMessage(memberId: string, messages: ChatMessage[]): boolean {
  const now = Date.now();
  return messages.some((message) => {
    if (message.sender !== "member") return false;
    const related = message.memberId === memberId;
    if (!related) return false;
    const ts = parseChatCreatedAtMs(message.createdAt);
    return ts > 0 && now - ts <= 48 * 60 * 60 * 1000;
  });
}

export function buildTrainerPtHomeAttentionClients(input: {
  followUpCards: TrainerFollowUpCardModel[];
  members: Member[];
  allMembers: Member[];
  logs: WorkoutLog[];
  messages: ChatMessage[];
  resolveAvatar: (member: Member) => string | null;
  limit?: number;
}): TrainerPtHomeAttentionClient[] {
  const seenIds = new Set<string>();
  const seenEmails = new Set<string>();
  const rows: TrainerPtHomeAttentionClient[] = [];

  const pushMember = (member: Member, statusLabel: string, statusTone: TrainerPtHomeAttentionClient["statusTone"]) => {
    const email = member.email.trim().toLowerCase();
    if (email && seenEmails.has(email)) return;
    if (seenIds.has(member.id)) return;
    seenIds.add(member.id);
    if (email) seenEmails.add(email);
    const days = trainerInactiveDaysForFollowUp(member, input.allMembers, input.logs);
    const lastActiveLabel =
      days === null
        ? "Ukjent aktivitet"
        : days === 0
          ? "Aktiv i dag"
          : days === 1
            ? "Sist aktiv: i går"
            : `Sist aktiv: ${days} dager siden`;
    rows.push({
      memberId: member.id,
      memberName: member.name,
      avatarUrl: input.resolveAvatar(member),
      statusLabel,
      statusTone,
      lastActiveLabel,
    });
  };

  for (const card of input.followUpCards) {
    const member = input.members.find((row) => row.id === card.memberId);
    if (!member) continue;
    const tone = card.priorityTone === "green" ? "ready" : card.priorityTone === "red" ? "inactive" : "waiting";
    pushMember(member, tone === "ready" ? "Klar for ny økt" : "Trenger oppfølging", tone);
  }

  for (const member of input.members.filter((row) => row.isActive !== false)) {
    if (rows.length >= (input.limit ?? 4)) break;
    if (seenIds.has(member.id)) continue;
    const email = member.email.trim().toLowerCase();
    if (email && seenEmails.has(email)) continue;
    if (memberHasRecentMessage(member.id, input.messages)) {
      pushMember(member, "Ny melding", "message");
      continue;
    }
    const days = trainerInactiveDaysForFollowUp(member, input.allMembers, input.logs);
    if (days !== null && days >= 7) {
      pushMember(member, "Lav aktivitet", "inactive");
    }
  }

  for (const member of input.members.filter((row) => row.isActive !== false)) {
    if (rows.length >= (input.limit ?? 4)) break;
    if (seenIds.has(member.id)) continue;
    const email = member.email.trim().toLowerCase();
    if (email && seenEmails.has(email)) continue;
    pushMember(member, "Avventer svar", "waiting");
  }

  return rows.slice(0, input.limit ?? 4);
}

export function buildTrainerPtHomeProgressSeries(logs: WorkoutLog[]): {
  points: TrainerPtHomeProgressPoint[];
  monthDeltaPct: number;
  topFocusLabel: string;
} {
  const now = new Date();
  const weeks: TrainerPtHomeProgressPoint[] = [];
  for (let index = 3; index >= 0; index -= 1) {
    const end = new Date(now);
    end.setDate(end.getDate() - index * 7);
    const start = new Date(end);
    start.setDate(start.getDate() - 6);
    const startMs = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
    const endMs = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime() + 24 * 60 * 60 * 1000;
    const count = logs.filter((log) => {
      const ts = parseLogDateMs(log.date);
      return ts >= startMs && ts < endMs;
    }).length;
    weeks.push({
      label: `U${4 - index}`,
      value: count,
    });
  }
  const current = weeks[weeks.length - 1]?.value ?? 0;
  const previous = weeks[weeks.length - 2]?.value ?? 0;
  const monthDeltaPct = previous > 0 ? Math.round(((current - previous) / previous) * 100) : current > 0 ? 100 : 0;
  return {
    points: weeks,
    monthDeltaPct,
    topFocusLabel: "Styrke",
  };
}

export function buildTrainerPtHomePopularContent(
  items: Array<{ id: string; title: string; createdAt?: string }>,
): TrainerPtHomePopularContent[] {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const recent = items
    .filter((item) => {
      const ts = Date.parse(item.createdAt ?? "");
      return !Number.isFinite(ts) || ts >= monthStart.getTime();
    })
    .slice(0, 6);
  const fallback = items.slice(0, 3);
  const picked = (recent.length ? recent : fallback).slice(0, 3);
  return picked.map((item, index) => ({
    id: item.id,
    title: item.title,
    shareLabel: `Delt ${Math.max(3, 14 - index * 3)} ganger`,
  }));
}

export function countNewMembersThisWeek(members: Member[]): number {
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  return members.filter((member) => {
    const invited = Date.parse(member.invitedAt ?? "");
    return Number.isFinite(invited) && now - invited <= weekMs;
  }).length;
}
