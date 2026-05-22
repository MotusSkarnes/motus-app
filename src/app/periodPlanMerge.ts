import { getDefaultPeriodPlanStartMondayISO, parseStoredLogDate } from "./dateFormat";
import { findProgramForPeriodPlanEntry, isPassivePeriodPlanEntry } from "./periodPlanEntryActions";
import { applyPeriodPlanSwaps, getSwapsForWeek, WEEKDAY_PLAN_ORDER, type PeriodPlanSwapsByPlan } from "./periodPlanSwaps";
import type { PeriodSchedulePlan, TrainingProgram, WeekdayPlanKey, WeeklyDayPlan, WeeklySchedulePlan } from "./types";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function localMondayBasedWeekdayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

/** Hele dager fra planstart. */
export function periodPlanDaysSinceStart(startDate: Date, targetDate: Date): number {
  const startMs = startOfLocalDay(startDate).getTime();
  const targetMs = startOfLocalDay(targetDate).getTime();
  return Math.floor((targetMs - startMs) / MS_PER_DAY);
}

/** Kolonnenøkkel for en kalenderdag — følger faktisk kalenderukedag, ikke alltid mandag som start. */
export function periodPlanWeekdayKeyForDate(startDate: Date, targetDate: Date): WeekdayPlanKey | null {
  const daysSinceStart = periodPlanDaysSinceStart(startDate, targetDate);
  if (daysSinceStart < 0) return null;
  return WEEKDAY_PLAN_ORDER[localMondayBasedWeekdayIndex(targetDate)];
}

export type PeriodPlanDayEntryMatch = {
  entry: string;
  weekNumber: number;
  day: WeekdayPlanKey;
};

export type PeriodPlanDayEntryMatchWithPlan = PeriodPlanDayEntryMatch & {
  plan: PeriodSchedulePlan;
};

const WEEKDAY_INDEX: Record<WeekdayPlanKey, number> = {
  monday: 0,
  tuesday: 1,
  wednesday: 2,
  thursday: 3,
  friday: 4,
  saturday: 5,
  sunday: 6,
};

/** Parser planstart på samme måte som kalender og lagring (ISO + dd.mm.yyyy). */
export function parsePeriodPlanStartDate(plan: PeriodSchedulePlan): Date | null {
  const ms = planStartTimeMs(plan);
  if (!ms) return null;
  return new Date(ms);
}

export function resolvePeriodPlanPlannedDate(plan: PeriodSchedulePlan, weekNumber: number, day: WeekdayPlanKey): Date | null {
  const start = parsePeriodPlanStartDate(plan);
  if (!start) return null;
  const weekIndex = Math.max(0, Math.floor(Number(weekNumber) || 1) - 1);
  const startWeekdayIndex = localMondayBasedWeekdayIndex(start);
  const dayOffset = weekIndex * 7 + ((WEEKDAY_INDEX[day] - startWeekdayIndex + 7) % 7);
  return new Date(start.getFullYear(), start.getMonth(), start.getDate() + dayOffset);
}

/** Finn økt for en kalenderdag — samme dato-beregning som vises i periodeplan-radene. */
export function findPeriodPlanEntryForCalendarDate(
  plan: PeriodSchedulePlan,
  targetDate: Date,
  swapsByPlan: PeriodPlanSwapsByPlan = {},
): PeriodPlanDayEntryMatch | null {
  const normalized = normalizePeriodSchedulePlan(plan);
  const targetMs = startOfLocalDay(targetDate).getTime();

  for (const week of normalized.weeklyPlans) {
    const swaps = getSwapsForWeek(swapsByPlan, plan.id, week.weekNumber);
    const effectiveDays = applyPeriodPlanSwaps(week.days, swaps);
    for (const day of WEEKDAY_PLAN_ORDER) {
      const plannedDate = resolvePeriodPlanPlannedDate(plan, week.weekNumber, day);
      if (!plannedDate || startOfLocalDay(plannedDate).getTime() !== targetMs) continue;
      return {
        entry: effectiveDays[day]?.trim() ?? "",
        weekNumber: week.weekNumber,
        day,
      };
    }
  }
  return null;
}

/** Første planlagte økt på en dato; foretrekker aktiv plan om angitt. */
export function findPeriodPlanEntryForCalendarDateInPlans(
  plans: PeriodSchedulePlan[],
  targetDate: Date,
  swapsByPlan: PeriodPlanSwapsByPlan = {},
  preferredPlanId?: string | null,
): PeriodPlanDayEntryMatchWithPlan | null {
  const ordered = preferredPlanId
    ? [...plans.filter((plan) => plan.id === preferredPlanId), ...plans.filter((plan) => plan.id !== preferredPlanId)]
    : plans;
  for (const plan of ordered) {
    const match = findPeriodPlanEntryForCalendarDate(plan, targetDate, swapsByPlan);
    if (match?.entry.trim()) {
      return { plan, ...match };
    }
  }
  return null;
}

/**
 * Dagens økt fra periodeplan: matcher planlagt kalenderdato på tvers av synlige planer,
 * med fallback til aktiv planuke når startdato mangler.
 */
export function findTodayPeriodPlanEntryInPlans(
  plans: PeriodSchedulePlan[],
  targetDate: Date,
  swapsByPlan: PeriodPlanSwapsByPlan = {},
  preferredPlanId?: string | null,
  activeWeekNumber?: number | null,
  calendarWeekdayKey?: WeekdayPlanKey,
): PeriodPlanDayEntryMatchWithPlan | null {
  const byDate = findPeriodPlanEntryForCalendarDateInPlans(plans, targetDate, swapsByPlan, preferredPlanId);
  if (byDate?.entry.trim()) return byDate;

  if (activeWeekNumber == null || !calendarWeekdayKey) return null;

  const ordered = preferredPlanId
    ? [...plans.filter((plan) => plan.id === preferredPlanId), ...plans.filter((plan) => plan.id !== preferredPlanId)]
    : plans;

  for (const plan of ordered) {
    const week = resolvePeriodPlanWeek(plan, activeWeekNumber);
    if (!week) continue;
    const start = parsePeriodPlanStartDate(plan);
    const swaps = getSwapsForWeek(swapsByPlan, plan.id, week.weekNumber);
    const effective = applyPeriodPlanSwaps(week.days, swaps);
    const dayFromStart = start ? periodPlanWeekdayKeyForDate(start, targetDate) : null;
    if (dayFromStart) {
      const entryFromStart = effective[dayFromStart]?.trim() ?? "";
      if (entryFromStart) return { plan, entry: entryFromStart, weekNumber: week.weekNumber, day: dayFromStart };
    } else {
      const entry = effective[calendarWeekdayKey]?.trim() ?? "";
      if (entry) return { plan, entry, weekNumber: week.weekNumber, day: calendarWeekdayKey };
    }
  }

  return null;
}

export type PeriodPlanAutoCompleteTarget = {
  planId: string;
  weekNumber: number;
  day: WeekdayPlanKey;
};

/** Om planlagt periodeplan-rad svarer til et fullført program (tittel / fuzzy match). */
export function periodPlanEntryMatchesCompletedProgram(
  entry: string,
  programTitle: string,
  programs: TrainingProgram[],
): boolean {
  const trimmedEntry = entry.trim();
  const trimmedTitle = programTitle.trim();
  if (!trimmedEntry || !trimmedTitle || isPassivePeriodPlanEntry(trimmedEntry)) return false;

  const entryProgram = findProgramForPeriodPlanEntry(trimmedEntry, programs);
  const titleProgram = findProgramForPeriodPlanEntry(trimmedTitle, programs);
  if (entryProgram && titleProgram) {
    return entryProgram.id === titleProgram.id;
  }
  if (entryProgram) {
    return entryProgram.title.trim().toLowerCase() === trimmedTitle.toLowerCase();
  }
  if (titleProgram) {
    return trimmedEntry.toLowerCase() === titleProgram.title.trim().toLowerCase();
  }
  return trimmedEntry.toLowerCase() === trimmedTitle.toLowerCase();
}

/** Finn periodeplan-rader som skal hakkes av når et program er fullført på en kalenderdag. */
export function findPeriodPlanAutoCompleteTargets(input: {
  plans: PeriodSchedulePlan[];
  swapsByPlan: PeriodPlanSwapsByPlan;
  programTitle: string;
  programs: TrainingProgram[];
  completedAt?: Date;
}): PeriodPlanAutoCompleteTarget[] {
  const completedAt = input.completedAt ?? new Date();
  const targets: PeriodPlanAutoCompleteTarget[] = [];
  const seen = new Set<string>();

  for (const plan of input.plans) {
    const match = findPeriodPlanEntryForCalendarDate(plan, completedAt, input.swapsByPlan);
    if (!match?.entry.trim()) continue;
    if (!periodPlanEntryMatchesCompletedProgram(match.entry, input.programTitle, input.programs)) continue;
    const key = `${plan.id}:${match.weekNumber}:${match.day}`;
    if (seen.has(key)) continue;
    seen.add(key);
    targets.push({ planId: plan.id, weekNumber: match.weekNumber, day: match.day });
  }

  return targets;
}

export type PeriodPlanWeekNavItem = {
  id: string;
  weekNumber: number;
  /** Uke inngår i felles «gradient»-blokk med samme dagplan som andre merkede uker. */
  usesGradientPlan?: boolean;
};

function planStartTimeMs(plan: PeriodSchedulePlan): number {
  const value = plan.startDate?.trim() ?? "";
  if (!value) return 0;
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const parsed = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    return Number.isNaN(parsed.getTime()) ? 0 : startOfLocalDay(parsed).getTime();
  }
  const stored = parseStoredLogDate(value);
  if (stored) return startOfLocalDay(stored).getTime();
  const fallback = new Date(value);
  return Number.isNaN(fallback.getTime()) ? 0 : startOfLocalDay(fallback).getTime();
}

function createEmptyWeeklyDayPlan(): WeeklyDayPlan {
  return {
    monday: "",
    tuesday: "",
    wednesday: "",
    thursday: "",
    friday: "",
    saturday: "",
    sunday: "",
  };
}

/** Alle uker med `usesGradientPlan` får samme dagplan (laveste ukenummer bestemmer innhold). */
export function syncGradientMarkedWeekDays(weeklyPlans: WeeklySchedulePlan[]): WeeklySchedulePlan[] {
  const marked = weeklyPlans
    .filter((week) => week.usesGradientPlan === true)
    .slice()
    .sort((a, b) => a.weekNumber - b.weekNumber);
  if (marked.length === 0) return weeklyPlans.map((week) => ({ ...week }));
  const days = { ...marked[0].days };
  return weeklyPlans.map((week) => (week.usesGradientPlan === true ? { ...week, days: { ...days } } : { ...week }));
}

export function buildPeriodPlanWeekNavItems(
  weeklyPlans: WeeklySchedulePlan[],
  totalWeeks: number,
  planId = "draft",
): PeriodPlanWeekNavItem[] {
  const weekCount = Math.max(
    1,
    Math.min(12, Math.max(weeklyPlans.length, Math.floor(Number(totalWeeks) || 1))),
  );
  return Array.from({ length: weekCount }, (_, index) => {
    const weekNumber = index + 1;
    const existing =
      weeklyPlans.find((week) => Number(week.weekNumber) === weekNumber) ?? weeklyPlans[index];
    return {
      id: existing?.id ?? `${planId}-week-${weekNumber}`,
      weekNumber,
      ...(existing?.usesGradientPlan === true ? { usesGradientPlan: true as const } : {}),
    };
  });
}

export function buildPeriodPlanWeekNavItemsFromPlan(plan: PeriodSchedulePlan): PeriodPlanWeekNavItem[] {
  return buildPeriodPlanWeekNavItems(plan.weeklyPlans ?? [], plan.weeks, plan.id);
}

export function normalizePeriodSchedulePlan(plan: PeriodSchedulePlan): PeriodSchedulePlan {
  const source = plan.weeklyPlans ?? [];
  const weeks = Math.max(
    1,
    Math.min(
      12,
      Math.max(
        source.length,
        Number.isFinite(Number(plan.weeks)) && Number(plan.weeks) > 0 ? Number(plan.weeks) : source.length || 1,
      ),
    ),
  );
  const weeklyPlansRaw: WeeklySchedulePlan[] = Array.from({ length: weeks }, (_, index) => {
    const weekNumber = index + 1;
    const existing = source.find((week) => Number(week.weekNumber) === weekNumber) ?? source[index];
    const base: WeeklySchedulePlan = {
      id: existing?.id ?? `${plan.id}-week-${weekNumber}`,
      weekNumber,
      days: existing?.days ?? createEmptyWeeklyDayPlan(),
    };
    if (existing?.usesGradientPlan === true) {
      return { ...base, usesGradientPlan: true };
    }
    return base;
  });
  const synced = syncGradientMarkedWeekDays(weeklyPlansRaw);
  const startDate = plan.startDate?.trim() || getDefaultPeriodPlanStartMondayISO();
  return { ...plan, startDate, weeks, weeklyPlans: synced };
}

export function resolvePeriodPlanWeek(plan: PeriodSchedulePlan, weekNumber: number): WeeklySchedulePlan | null {
  const normalized = normalizePeriodSchedulePlan(plan);
  const planWeeks = normalized.weeklyPlans ?? [];
  if (!planWeeks.length) return null;
  const target = Math.max(1, Math.min(planWeeks.length, Math.floor(Number(weekNumber) || 1)));
  return (
    planWeeks.find((week) => Number(week.weekNumber) === target) ?? planWeeks[target - 1] ?? planWeeks[0] ?? null
  );
}

export function periodPlanSelectableWeekCount(plan: PeriodSchedulePlan): number {
  const normalized = normalizePeriodSchedulePlan(plan);
  return normalized.weeklyPlans.length;
}

export const PERIOD_PLANS_BY_MEMBER_STORAGE_KEY = "motus.trainer.periodPlansByMemberId";
export const HIDDEN_PERIOD_PLAN_IDS_BY_MEMBER_STORAGE_KEY = "motus.member.hiddenPeriodPlanIdsByMemberId";

/** Planer fra Supabase / trener er ikke medlems-eide. */
export function buildTrainerPeriodPlanIdSet(
  relatedMemberIds: string[],
  remoteRows: Array<{ memberId: string; plan: PeriodSchedulePlan }>,
): Set<string> {
  const idSet = new Set(relatedMemberIds.map((id) => id.trim()).filter(Boolean));
  const trainerIds = new Set<string>();
  for (const row of remoteRows) {
    if (!idSet.has(row.memberId.trim())) continue;
    trainerIds.add(row.plan.id);
  }
  return trainerIds;
}

export function isMemberOwnedPeriodPlan(plan: PeriodSchedulePlan, trainerPlanIds: ReadonlySet<string>): boolean {
  if (plan.periodPlanAddedBy === "member") return true;
  if (plan.periodPlanAddedBy === "trainer") return false;
  if (trainerPlanIds.has(plan.id)) return false;
  return /-\d{10,}$/.test(plan.id);
}

export function readPeriodPlansByMemberId(): Record<string, PeriodSchedulePlan[]> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(PERIOD_PLANS_BY_MEMBER_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, PeriodSchedulePlan[]>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function writePeriodPlansByMemberId(byMember: Record<string, PeriodSchedulePlan[]>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PERIOD_PLANS_BY_MEMBER_STORAGE_KEY, JSON.stringify(byMember));
}

export function readHiddenPeriodPlanIdsForMembers(memberIds: string[]): string[] {
  if (typeof window === "undefined" || memberIds.length === 0) return [];
  try {
    const raw = window.localStorage.getItem(HIDDEN_PERIOD_PLAN_IDS_BY_MEMBER_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Record<string, string[]>;
    if (!parsed || typeof parsed !== "object") return [];
    const hidden = new Set<string>();
    for (const memberId of memberIds) {
      for (const planId of parsed[memberId] ?? []) {
        if (typeof planId === "string" && planId.trim()) hidden.add(planId);
      }
    }
    return Array.from(hidden);
  } catch {
    return [];
  }
}

export function writeHiddenPeriodPlanIdsForMember(memberId: string, planIds: string[]) {
  if (typeof window === "undefined" || !memberId.trim()) return;
  let byMember: Record<string, string[]> = {};
  try {
    const raw = window.localStorage.getItem(HIDDEN_PERIOD_PLAN_IDS_BY_MEMBER_STORAGE_KEY);
    byMember = raw ? (JSON.parse(raw) as Record<string, string[]>) : {};
    if (!byMember || typeof byMember !== "object") byMember = {};
  } catch {
    byMember = {};
  }
  byMember[memberId] = planIds;
  window.localStorage.setItem(HIDDEN_PERIOD_PLAN_IDS_BY_MEMBER_STORAGE_KEY, JSON.stringify(byMember));
}

export function writeHiddenPeriodPlanIdsForMembers(memberIds: string[], planIds: string[]) {
  if (typeof window === "undefined") return;
  const cleanMemberIds = Array.from(new Set(memberIds.map((id) => id.trim()).filter(Boolean)));
  if (cleanMemberIds.length === 0) return;
  let byMember: Record<string, string[]> = {};
  try {
    const raw = window.localStorage.getItem(HIDDEN_PERIOD_PLAN_IDS_BY_MEMBER_STORAGE_KEY);
    byMember = raw ? (JSON.parse(raw) as Record<string, string[]>) : {};
    if (!byMember || typeof byMember !== "object") byMember = {};
  } catch {
    byMember = {};
  }
  for (const memberId of cleanMemberIds) {
    byMember[memberId] = planIds;
  }
  window.localStorage.setItem(HIDDEN_PERIOD_PLAN_IDS_BY_MEMBER_STORAGE_KEY, JSON.stringify(byMember));
}

export function removeMemberOwnedPeriodPlanFromStorage(memberIds: string[], planId: string): boolean {
  const byMember = readPeriodPlansByMemberId();
  let changed = false;
  for (const memberId of memberIds) {
    const previous = byMember[memberId] ?? [];
    const next = previous.filter((plan) => plan.id !== planId);
    if (next.length !== previous.length) {
      byMember[memberId] = next;
      changed = true;
    }
  }
  if (changed) writePeriodPlansByMemberId(byMember);
  return changed;
}

export function mergedPeriodPlanListForMember(
  relatedMemberIds: string[],
  localByMember: Record<string, PeriodSchedulePlan[]>,
  remoteRows: Array<{ memberId: string; plan: PeriodSchedulePlan }>,
): PeriodSchedulePlan[] {
  const merged = new Map<string, PeriodSchedulePlan>();
  const idSet = new Set(relatedMemberIds.map((id) => id.trim()).filter(Boolean));
  for (const memberId of idSet) {
    for (const plan of localByMember[memberId] ?? []) {
      if (!merged.has(plan.id)) merged.set(plan.id, normalizePeriodSchedulePlan(plan));
    }
  }
  for (const row of remoteRows) {
    if (!idSet.has(row.memberId.trim())) continue;
    merged.set(row.plan.id, normalizePeriodSchedulePlan(row.plan));
  }
  return Array.from(merged.values()).sort((a, b) => planStartTimeMs(b) - planStartTimeMs(a));
}
