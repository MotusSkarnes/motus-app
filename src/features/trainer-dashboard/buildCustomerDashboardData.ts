import type { ChatMessage, Member, TrainingProgram, WorkoutLog } from "../../app/types";

export type CustomerMetrics = {
  trainingDays: number;
  completionPct: number;
  activityLevel: "Høyt" | "Middels" | "Lavt";
  activityScore: number;
  programStatus: string;
  programStatusTone: "mint" | "pink" | "neutral";
  responseRatePct: number;
};

export type CustomerTimelineItem = {
  id: string;
  icon: "workout" | "message" | "program" | "measure";
  title: string;
  timeLabel: string;
  actionLabel: string;
  timestamp: number;
};

export type CustomerFollowUpItem = {
  id: string;
  title: string;
  priority: "high" | "medium" | "low";
};

function parseLogMs(date: string): number {
  const trimmed = date.trim();
  if (!trimmed) return 0;
  const iso = trimmed.includes("T") ? trimmed : `${trimmed}T12:00:00`;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : 0;
}

function parseChatMs(value: string): number {
  const ms = Date.parse(value.trim());
  return Number.isFinite(ms) ? ms : 0;
}

function formatRelativeTime(ms: number): string {
  if (ms <= 0) return "";
  const diffMin = Math.floor((Date.now() - ms) / 60000);
  if (diffMin < 1) return "nå";
  if (diffMin < 60) return `${diffMin} min siden`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH} t siden`;
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return "i går";
  if (diffD < 7) return `${diffD} d siden`;
  return new Date(ms).toLocaleDateString("nb-NO", { day: "numeric", month: "short" });
}

export function buildCustomerMetrics(input: {
  memberLogs: WorkoutLog[];
  programs: TrainingProgram[];
  memberMessages: ChatMessage[];
}): CustomerMetrics {
  const now = Date.now();
  const fourWeeksMs = 28 * 24 * 60 * 60 * 1000;
  const recentLogs = input.memberLogs.filter((log) => {
    const ms = parseLogMs(log.date);
    return ms > 0 && now - ms <= fourWeeksMs;
  });
  const completed = recentLogs.filter((log) => String(log.status ?? "").trim() === "Fullført");
  const uniqueDays = new Set(
    completed.map((log) => {
      const ms = parseLogMs(log.date);
      const d = new Date(ms);
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    }),
  ).size;
  const completionPct =
    recentLogs.length > 0 ? Math.round((completed.length / recentLogs.length) * 100) : 0;
  const activityScore = Math.min(10, Math.max(1, Math.round(uniqueDays / 2.8) || (completed.length > 0 ? 4 : 2)));
  const activityLevel = activityScore >= 7 ? "Høyt" : activityScore >= 4 ? "Middels" : "Lavt";
  const hasProgram = input.programs.length > 0;
  const memberSent = input.memberMessages.filter((m) => m.sender === "member").length;
  const trainerSent = input.memberMessages.filter((m) => m.sender === "trainer").length;
  const responseRatePct =
    memberSent > 0 ? Math.min(100, Math.round((Math.min(trainerSent, memberSent) / memberSent) * 100)) : 100;

  return {
    trainingDays: uniqueDays,
    completionPct,
    activityLevel,
    activityScore,
    programStatus: hasProgram
      ? input.programs[0]?.title?.trim() || "Aktivt program"
      : "Mangler oppdatering",
    programStatusTone: hasProgram ? "mint" : "pink",
    responseRatePct,
  };
}

export function buildCustomerTimeline(input: {
  memberLogs: WorkoutLog[];
  memberMessages: ChatMessage[];
}): CustomerTimelineItem[] {
  const items: CustomerTimelineItem[] = [];

  input.memberLogs.forEach((log) => {
    const ts = parseLogMs(log.date);
    if (ts <= 0) return;
    const completed = String(log.status ?? "").trim() === "Fullført";
    items.push({
      id: `log-${log.id}`,
      icon: "workout",
      title: completed ? `Fullførte ${log.programTitle || "økt"}` : `Startet ${log.programTitle || "økt"}`,
      timeLabel: formatRelativeTime(ts),
      actionLabel: completed ? "Se logg" : "Åpne",
      timestamp: ts,
    });
  });

  input.memberMessages.slice(-12).forEach((message) => {
    const ts = parseChatMs(message.createdAt);
    if (ts <= 0) return;
    items.push({
      id: `msg-${message.id}`,
      icon: "message",
      title: message.sender === "member" ? "Ny melding fra kunde" : "Du sendte melding",
      timeLabel: formatRelativeTime(ts),
      actionLabel: "Åpne",
      timestamp: ts,
    });
  });

  return items.sort((a, b) => b.timestamp - a.timestamp).slice(0, 8);
}

export function buildCustomerFollowUpItems(input: {
  nextAction: string;
  reasons: string[];
  hasProgram: boolean;
  daysSinceWorkout: number | null;
}): CustomerFollowUpItem[] {
  const items: CustomerFollowUpItem[] = [];
  if (!input.hasProgram) {
    items.push({ id: "program", title: "Send nytt program", priority: "high" });
  }
  if (input.daysSinceWorkout !== null && input.daysSinceWorkout >= 7) {
    items.push({ id: "inactive", title: "Følg opp inaktivitet", priority: "high" });
  }
  input.reasons.slice(0, 2).forEach((reason, index) => {
    items.push({
      id: `reason-${index}`,
      title: reason.charAt(0).toUpperCase() + reason.slice(1),
      priority: index === 0 ? "medium" : "low",
    });
  });
  if (input.nextAction && !items.some((item) => item.title === input.nextAction)) {
    items.push({
      id: "next",
      title: input.nextAction,
      priority: "medium",
    });
  }
  if (!items.length) {
    items.push({ id: "checkin", title: "Send en kort check-in", priority: "low" });
  }
  return items.slice(0, 5);
}

export function memberAgeLabel(birthDate: string | undefined): string | null {
  const raw = (birthDate ?? "").trim();
  if (!raw) return null;
  const ms = Date.parse(raw.includes(".") ? raw.split(".").reverse().join("-") : raw);
  if (!Number.isFinite(ms)) return null;
  const age = Math.floor((Date.now() - ms) / (365.25 * 24 * 60 * 60 * 1000));
  return age > 0 && age < 120 ? `${age} år` : null;
}
