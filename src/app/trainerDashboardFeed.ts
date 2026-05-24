import type { Member, WorkoutLog } from "./types";
import { trainerInactiveDaysForFollowUp } from "./memberActivity";
import { parseLogDateMs } from "./workoutLogDate";

export type TrainerFocusItem = {
  id: string;
  text: string;
  tone: "critical" | "warning" | "neutral";
};

export type TrainerTodayFeedItem = {
  id: string;
  timeLabel: string;
  title: string;
  subtitle?: string;
  tone: "followup" | "task" | "workout" | "program";
};

export function coachingStatusLabel(tone: "red" | "orange" | "green"): string {
  if (tone === "red") return "Krever oppfølging";
  if (tone === "orange") return "Mister momentum";
  return "Stabil";
}

export function buildTrainerFocusItems(input: {
  followUpCount: number;
  inactiveLastWeekCount: number;
  membersWithoutProgramCount: number;
  newMessages24h: number;
}): TrainerFocusItem[] {
  const items: TrainerFocusItem[] = [];
  if (input.followUpCount > 0) {
    items.push({
      id: "follow-up",
      text: `${input.followUpCount} ${input.followUpCount === 1 ? "kunde trenger" : "kunder trenger"} oppfølging`,
      tone: "critical",
    });
  }
  if (input.inactiveLastWeekCount > 0) {
    items.push({
      id: "inactive",
      text: `${input.inactiveLastWeekCount} ${input.inactiveLastWeekCount === 1 ? "kunde har" : "kunder har"} ikke trent siste uke`,
      tone: input.inactiveLastWeekCount >= 3 ? "critical" : "warning",
    });
  }
  if (input.membersWithoutProgramCount > 0) {
    items.push({
      id: "programs",
      text: `${input.membersWithoutProgramCount} ${input.membersWithoutProgramCount === 1 ? "program må" : "programmer må"} oppdateres`,
      tone: "warning",
    });
  }
  if (input.newMessages24h > 0) {
    items.push({
      id: "messages",
      text: `${input.newMessages24h} nye meldinger siste 24 timer`,
      tone: "neutral",
    });
  }
  if (!items.length) {
    items.push({
      id: "clear",
      text: "Ingen kritiske oppgaver akkurat nå — god flyt!",
      tone: "neutral",
    });
  }
  return items;
}

export function countInactiveLastWeek(members: Member[], allMembers: Member[], logs: WorkoutLog[]): number {
  return members.filter((member) => {
    const days = trainerInactiveDaysForFollowUp(member, allMembers, logs);
    return days !== null && days >= 7;
  }).length;
}

export function buildTrainerTodayFeed(input: {
  followUpNames: string[];
  todos: Array<{ id: string; title: string; done: boolean }>;
  todaysLogs: WorkoutLog[];
  membersById: Map<string, Member>;
}): TrainerTodayFeedItem[] {
  const items: TrainerTodayFeedItem[] = [];
  input.followUpNames.slice(0, 2).forEach((name, index) => {
    items.push({
      id: `followup-${index}`,
      timeLabel: `${String(9 + index * 2).padStart(2, "0")}:00`,
      title: `Følg opp ${name}`,
      tone: "followup",
    });
  });

  const openTodos = input.todos.filter((todo) => !todo.done);
  openTodos.slice(0, 3).forEach((todo, index) => {
    items.push({
      id: `todo-${todo.id}`,
      timeLabel: `${String(11 + index * 2).padStart(2, "0")}:00`,
      title: todo.title,
      tone: "task",
    });
  });

  input.todaysLogs.slice(0, 3).forEach((log, index) => {
    const member = input.membersById.get(log.memberId);
    const ts = parseLogDateMs(log.date);
    const timeLabel =
      ts > 0
        ? new Date(ts).toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" })
        : `${String(14 + index).padStart(2, "0")}:00`;
    items.push({
      id: `log-${log.id}`,
      timeLabel,
      title: member ? `${member.name.split(" ")[0]} – ${log.programTitle}` : log.programTitle,
      subtitle: "Økt logget i dag",
      tone: "workout",
    });
  });

  return items.sort((a, b) => a.timeLabel.localeCompare(b.timeLabel, "no"));
}

export function buildTrainerInsightText(atRiskCount: number, followUpCount: number): { title: string; detail: string } {
  if (atRiskCount >= 2) {
    return {
      title: "Innsikt denne uken",
      detail: `${atRiskCount} kunder med økt risiko for frafall. Følg opp disse for å styrke resultatene deres.`,
    };
  }
  if (followUpCount > 0) {
    return {
      title: "Innsikt denne uken",
      detail: `${followUpCount} ${followUpCount === 1 ? "kunde bør" : "kunder bør"} prioriteres for å holde momentumet oppe.`,
    };
  }
  return {
    title: "Innsikt denne uken",
    detail: "Kundene dine trener jevnt. Fortsett med proaktiv oppfølging for å holde relasjonene sterke.",
  };
}
