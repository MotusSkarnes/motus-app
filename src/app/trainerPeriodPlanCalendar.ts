import { computeRelatedMemberIdSet, logsAttributedToMember } from "./memberActivity";
import { toCalendarDateKey, type TrainingCalendarDayStatus } from "./memberTrainingCalendar";
import { findPeriodPlanEntryForCalendarDate } from "./periodPlanMerge";
import {
  getPeriodPlanDayListLabel,
  isPassivePeriodPlanEntry,
  resolvePeriodPlanEntryAction,
} from "./periodPlanEntryActions";
import { parseLogDateMs } from "./workoutLogDate";
import type { Member, PeriodSchedulePlan, WorkoutLog } from "./types";

export type TrainerCalendarPlanEntry = {
  memberId: string;
  memberName: string;
  planId: string;
  planTitle: string;
  entry: string;
  entryLabel: string;
  status: TrainingCalendarDayStatus;
  isPassive: boolean;
};

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function collectMemberPeriodPlans(
  member: Member,
  allMembers: Member[],
  periodPlansByMemberId: Record<string, PeriodSchedulePlan[]>,
): PeriodSchedulePlan[] {
  const relatedIds = computeRelatedMemberIdSet(member, allMembers);
  const dedup = new Map<string, PeriodSchedulePlan>();
  relatedIds.forEach((memberId) => {
    for (const plan of periodPlansByMemberId[memberId] ?? []) {
      if (!dedup.has(plan.id)) dedup.set(plan.id, plan);
    }
  });
  return Array.from(dedup.values());
}

function memberHasCompletedWorkoutOnDate(member: Member, allMembers: Member[], logs: WorkoutLog[], date: Date): boolean {
  const targetMs = startOfLocalDay(date).getTime();
  return logsAttributedToMember(member, allMembers, logs).some((log) => {
    if (log.status !== "Fullført") return false;
    const logMs = parseLogDateMs(log.date);
    if (!logMs) return false;
    return startOfLocalDay(new Date(logMs)).getTime() === targetMs;
  });
}

function resolveEntryStatus(
  member: Member,
  allMembers: Member[],
  logs: WorkoutLog[],
  date: Date,
  entry: string,
  todayStart: Date,
): TrainingCalendarDayStatus {
  if (isPassivePeriodPlanEntry(entry)) return "none";
  if (memberHasCompletedWorkoutOnDate(member, allMembers, logs, date)) return "completed";
  if (date.getTime() < todayStart.getTime()) return "missed";
  return "planned";
}

export function buildTrainerPeriodPlanCalendarByMonth(input: {
  members: Member[];
  periodPlansByMemberId: Record<string, PeriodSchedulePlan[]>;
  logs: WorkoutLog[];
  calendarMonth: Date;
  today?: Date;
}): {
  byDay: Map<number, TrainerCalendarPlanEntry[]>;
  byDateKey: Map<string, TrainerCalendarPlanEntry[]>;
} {
  const today = input.today ?? new Date();
  const todayStart = startOfLocalDay(today);
  const month = input.calendarMonth.getMonth();
  const year = input.calendarMonth.getFullYear();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const byDay = new Map<number, TrainerCalendarPlanEntry[]>();
  const byDateKey = new Map<string, TrainerCalendarPlanEntry[]>();

  const activeMembers = input.members.filter((member) => member.isActive !== false);

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month, day);
    const dateKey = toCalendarDateKey(date);
    const entries: TrainerCalendarPlanEntry[] = [];

    for (const member of activeMembers) {
      const plans = collectMemberPeriodPlans(member, input.members, input.periodPlansByMemberId);
      if (!plans.length) continue;

      for (const plan of plans) {
        const match = findPeriodPlanEntryForCalendarDate(plan, date);
        const entry = match?.entry.trim() ?? "";
        if (!entry) continue;

        const action = resolvePeriodPlanEntryAction(entry, []);
        const entryLabel = getPeriodPlanDayListLabel(entry, action);
        const isPassive = isPassivePeriodPlanEntry(entry);

        entries.push({
          memberId: member.id,
          memberName: member.name.trim() || "Kunde",
          planId: plan.id,
          planTitle: plan.title.trim() || "Periodeplan",
          entry,
          entryLabel,
          status: resolveEntryStatus(member, input.members, input.logs, date, entry, todayStart),
          isPassive,
        });
      }
    }

    entries.sort((a, b) => a.memberName.localeCompare(b.memberName, "no"));
    byDay.set(day, entries);
    byDateKey.set(dateKey, entries);
  }

  return { byDay, byDateKey };
}

export function summarizeTrainerCalendarDay(entries: TrainerCalendarPlanEntry[]): {
  activeCount: number;
  completedCount: number;
  missedCount: number;
  dayStatus: TrainingCalendarDayStatus;
} {
  const active = entries.filter((entry) => !entry.isPassive);
  const completedCount = active.filter((entry) => entry.status === "completed").length;
  const missedCount = active.filter((entry) => entry.status === "missed").length;
  const plannedCount = active.filter((entry) => entry.status === "planned").length;

  let dayStatus: TrainingCalendarDayStatus = "none";
  if (active.length === 0) {
    dayStatus = entries.some((entry) => entry.isPassive) ? "planned" : "none";
  } else if (completedCount === active.length) {
    dayStatus = "completed";
  } else if (missedCount > 0) {
    dayStatus = "missed";
  } else if (plannedCount > 0) {
    dayStatus = "planned";
  }

  return {
    activeCount: active.length,
    completedCount,
    missedCount,
    dayStatus,
  };
}

export function buildTrainerCalendarMonthCells(calendarMonth: Date): Array<number | null> {
  const firstDayOfMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
  const daysInMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate();
  const monthOffset = (firstDayOfMonth.getDay() + 6) % 7;
  return Array.from({ length: monthOffset + daysInMonth }, (_, index) => {
    const day = index - monthOffset + 1;
    if (day <= 0) return null;
    return day;
  });
}
