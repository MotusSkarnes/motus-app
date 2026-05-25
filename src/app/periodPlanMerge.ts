import { getDefaultPeriodPlanStartMondayISO, parseStoredLogDate } from "./dateFormat";
import { findProgramForPeriodPlanEntry, isPassivePeriodPlanEntry, isGroupPeriodPlanEntry, groupWorkoutLogTitle, resolveGroupClassNameFromPeriodEntry } from "./periodPlanEntryActions";
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

/** Planlagte økter per kalenderdag i en måned — kun fra angitte planer. */
export function buildPeriodPlanPlannedEntriesByMonth(input: {
  plans: PeriodSchedulePlan[];
  swapsByPlan: PeriodPlanSwapsByPlan;
  calendarMonth: Date;
}): Map<number, string[]> {
  const byDay = new Map<number, string[]>();
  const month = input.calendarMonth.getMonth();
  const year = input.calendarMonth.getFullYear();

  for (const plan of input.plans) {
    for (const week of plan.weeklyPlans ?? []) {
      for (const weekdayKey of WEEKDAY_PLAN_ORDER) {
        const swaps = getSwapsForWeek(input.swapsByPlan, plan.id, week.weekNumber);
        const effectiveDays = applyPeriodPlanSwaps(week.days, swaps);
        const plannedEntry = effectiveDays[weekdayKey]?.trim() ?? "";
        if (!plannedEntry) continue;
        const plannedDate = resolvePeriodPlanPlannedDate(plan, week.weekNumber, weekdayKey);
        if (!plannedDate) continue;
        if (plannedDate.getMonth() !== month || plannedDate.getFullYear() !== year) continue;
        const day = plannedDate.getDate();
        const previous = byDay.get(day) ?? [];
        byDay.set(day, [...previous, plannedEntry]);
      }
    }
  }

  return byDay;
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

/**
 * Dagens økt for hjemskjerm / Start økt: nyeste synlige plan med treff på dato vinner,
 * uavhengig av manuelt valgt aktiv plan (unngår at gammel plan styrer når trener har lagt ut ny).
 * `plans` bør være sortert med nyeste startdato først.
 */
export function resolveTodayPeriodPlanEntryForHome(
  plans: PeriodSchedulePlan[],
  targetDate: Date,
  swapsByPlan: PeriodPlanSwapsByPlan = {},
  calendarWeekdayKey?: WeekdayPlanKey,
): PeriodPlanDayEntryMatchWithPlan | null {
  if (!plans.length) return null;

  for (const plan of plans) {
    const match = findPeriodPlanEntryForCalendarDate(plan, targetDate, swapsByPlan);
    if (match?.entry.trim()) {
      return { plan, ...match };
    }
  }

  if (!calendarWeekdayKey) return null;

  for (const plan of plans) {
    const weekNumber = resolvePeriodPlanWeekNumberForDate(plan, targetDate);
    const week = resolvePeriodPlanWeek(plan, weekNumber);
    if (!week) continue;
    const start = parsePeriodPlanStartDate(plan);
    const swaps = getSwapsForWeek(swapsByPlan, plan.id, week.weekNumber);
    const effective = applyPeriodPlanSwaps(week.days, swaps);
    const dayFromStart = start ? periodPlanWeekdayKeyForDate(start, targetDate) : null;
    const day = dayFromStart ?? calendarWeekdayKey;
    const entry = effective[day]?.trim() ?? "";
    if (entry) {
      return { plan, entry, weekNumber: week.weekNumber, day };
    }
  }

  return null;
}

export type PeriodPlanAutoCompleteTarget = {
  planId: string;
  weekNumber: number;
  day: WeekdayPlanKey;
};

/** Om planlagt periodeplan-rad svarer til et fullført program (tittel / fuzzy match / program-id). */
function normalizeCompletionLabel(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .replace(/[.:;,-]+$/g, "")
    .trim();
}

export function periodPlanEntryMatchesCompletedProgram(
  entry: string,
  programTitle: string,
  programs: TrainingProgram[],
  programId?: string,
): boolean {
  const trimmedEntry = entry.trim();
  const trimmedTitle = programTitle.trim();
  if (!trimmedEntry || !trimmedTitle || isPassivePeriodPlanEntry(trimmedEntry)) return false;

  if (isGroupPeriodPlanEntry(trimmedEntry)) {
    const expectedTitle = groupWorkoutLogTitle(resolveGroupClassNameFromPeriodEntry(trimmedEntry));
    const entryNorm = trimmedEntry.toLowerCase();
    const logNorm = trimmedTitle.toLowerCase();
    const expectedNorm = expectedTitle.toLowerCase();
    return entryNorm === logNorm || expectedNorm === logNorm;
  }

  const trimmedProgramId = programId?.trim() ?? "";
  if (trimmedProgramId) {
    const entryProgram = findProgramForPeriodPlanEntry(trimmedEntry, programs);
    if (entryProgram?.id === trimmedProgramId) return true;
  }

  const entryNorm = normalizeCompletionLabel(trimmedEntry);
  const titleNorm = normalizeCompletionLabel(trimmedTitle);
  if (entryNorm === titleNorm) return true;

  const entryProgram = findProgramForPeriodPlanEntry(trimmedEntry, programs);
  if (entryProgram && normalizeCompletionLabel(entryProgram.title) === titleNorm) return true;
  return false;
}

export function buildPeriodPlanEntryKey(planId: string, weekNumber: number, day: WeekdayPlanKey): string {
  return `${planId}:${weekNumber}:${day}`;
}

export function isPeriodPlanDayComplete(input: {
  planId: string;
  weekNumber: number;
  day: WeekdayPlanKey;
  entry: string;
  completedKeys: string[];
  dismissedKeys?: string[];
  programs: TrainingProgram[];
  logsForDate?: Array<{ programTitle: string; status: string }>;
}): boolean {
  const key = buildPeriodPlanEntryKey(input.planId, input.weekNumber, input.day);
  if (input.dismissedKeys?.includes(key)) return false;
  if (input.completedKeys.includes(key)) return true;

  const trimmedEntry = input.entry.trim();
  if (!trimmedEntry) return false;

  if (!input.logsForDate) return false;
  if (!input.logsForDate.length) return false;

  return input.logsForDate.some(
    (log) =>
      log.status === "Fullført" &&
      periodPlanEntryMatchesCompletedProgram(trimmedEntry, log.programTitle, input.programs),
  );
}

/** Finn periodeplan-rader som skal hakkes av når et program er fullført på en kalenderdag. */
export function findPeriodPlanAutoCompleteTargets(input: {
  plans: PeriodSchedulePlan[];
  swapsByPlan: PeriodPlanSwapsByPlan;
  programTitle: string;
  programs: TrainingProgram[];
  programId?: string;
  completedAt?: Date;
  /**
   * Ukedag (mandag–søndag) for `completedAt` — brukes som fallback når planen mangler startdato
   * eller når dagens dato ikke flukter med en konkret planlagt dag. Speiler logikken i
   * `resolveTodayPeriodPlanEntryForHome` slik at auto-fullføring fungerer for plan uten startdato.
   */
  calendarWeekdayKey?: WeekdayPlanKey;
}): PeriodPlanAutoCompleteTarget[] {
  const completedAt = input.completedAt ?? new Date();
  const targets: PeriodPlanAutoCompleteTarget[] = [];
  const seen = new Set<string>();

  function pushTarget(planId: string, weekNumber: number, day: WeekdayPlanKey) {
    const key = buildPeriodPlanEntryKey(planId, weekNumber, day);
    if (seen.has(key)) return;
    seen.add(key);
    targets.push({ planId, weekNumber, day });
  }

  for (const plan of input.plans) {
    const match = findPeriodPlanEntryForCalendarDate(plan, completedAt, input.swapsByPlan);
    if (match?.entry.trim()) {
      if (
        periodPlanEntryMatchesCompletedProgram(match.entry, input.programTitle, input.programs, input.programId)
      ) {
        pushTarget(plan.id, match.weekNumber, match.day);
      }
      continue;
    }

    if (!input.calendarWeekdayKey) continue;

    const weekNumber = resolvePeriodPlanWeekNumberForDate(plan, completedAt);
    const week = resolvePeriodPlanWeek(plan, weekNumber);
    if (!week) continue;
    const start = parsePeriodPlanStartDate(plan);
    const swaps = getSwapsForWeek(input.swapsByPlan, plan.id, week.weekNumber);
    const effectiveDays = applyPeriodPlanSwaps(week.days, swaps);
    const dayFromStart = start ? periodPlanWeekdayKeyForDate(start, completedAt) : null;
    const day = dayFromStart ?? input.calendarWeekdayKey;
    const entry = effectiveDays[day]?.trim() ?? "";
    if (!entry) continue;
    if (
      !periodPlanEntryMatchesCompletedProgram(entry, input.programTitle, input.programs, input.programId)
    ) {
      continue;
    }
    pushTarget(plan.id, week.weekNumber, day);
  }

  return targets;
}

/** Avled fullførte periodeplan-nøkler fra fullførte øktlogger (synk ved oppstart). */
export function derivePeriodPlanCompletedEntryKeysFromLogs(input: {
  plans: PeriodSchedulePlan[];
  swapsByPlan: PeriodPlanSwapsByPlan;
  programs: TrainingProgram[];
  logs: Array<{ memberId: string; programTitle: string; date: string; status: string }>;
  memberId: string;
  memberIds?: string[];
  dismissedKeys?: string[];
}): string[] {
  const memberIds = new Set(
    (input.memberIds?.length ? input.memberIds : [input.memberId])
      .map((id) => id.trim())
      .filter(Boolean),
  );
  if (!memberIds.size) return [];

  const keys = new Set<string>();
  for (const log of input.logs) {
    if (!memberIds.has(log.memberId.trim())) continue;
    if (log.status !== "Fullført") continue;
    const completedAt = parseStoredLogDate(log.date);
    if (!completedAt) continue;

    const targets = findPeriodPlanAutoCompleteTargets({
      plans: input.plans,
      swapsByPlan: input.swapsByPlan,
      programTitle: log.programTitle,
      programs: input.programs,
      completedAt,
      calendarWeekdayKey: WEEKDAY_PLAN_ORDER[localMondayBasedWeekdayIndex(completedAt)],
    });
    for (const target of targets) {
      const key = buildPeriodPlanEntryKey(target.planId, target.weekNumber, target.day);
      if (input.dismissedKeys?.includes(key)) continue;
      keys.add(key);
    }
  }

  return Array.from(keys);
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
export const ACTIVE_PERIOD_PLAN_IDS_BY_MEMBER_STORAGE_KEY = "motus.member.activePeriodPlanIdByMemberId";

/** Kalenderuke (1-basert) for en plan på en gitt dato. */
export function resolvePeriodPlanWeekNumberForDate(plan: PeriodSchedulePlan, targetDate: Date): number {
  const start = parsePeriodPlanStartDate(plan);
  const planWeekCount = Math.max(1, periodPlanSelectableWeekCount(plan));
  if (!start) return 1;
  const daysSinceStart = periodPlanDaysSinceStart(start, targetDate);
  if (daysSinceStart < 0) return 1;
  const weekIndex = Math.floor(daysSinceStart / 7);
  return Math.min(planWeekCount, weekIndex + 1);
}

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

export function readActivePeriodPlanIdForMembers(memberIds: string[]): string | null {
  if (typeof window === "undefined" || memberIds.length === 0) return null;
  try {
    const raw = window.localStorage.getItem(ACTIVE_PERIOD_PLAN_IDS_BY_MEMBER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, string>;
    if (!parsed || typeof parsed !== "object") return null;
    for (const memberId of memberIds) {
      const planId = String(parsed[memberId] ?? "").trim();
      if (planId) return planId;
    }
    return null;
  } catch {
    return null;
  }
}

export function writeActivePeriodPlanIdForMembers(memberIds: string[], planId: string | null) {
  if (typeof window === "undefined") return;
  const trimmedIds = memberIds.map((id) => id.trim()).filter(Boolean);
  if (trimmedIds.length === 0) return;
  let byMember: Record<string, string> = {};
  try {
    const raw = window.localStorage.getItem(ACTIVE_PERIOD_PLAN_IDS_BY_MEMBER_STORAGE_KEY);
    byMember = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    if (!byMember || typeof byMember !== "object") byMember = {};
  } catch {
    byMember = {};
  }
  const value = planId?.trim() ?? "";
  trimmedIds.forEach((memberId) => {
    if (value) byMember[memberId] = value;
    else delete byMember[memberId];
  });
  window.localStorage.setItem(ACTIVE_PERIOD_PLAN_IDS_BY_MEMBER_STORAGE_KEY, JSON.stringify(byMember));
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

export function computePeriodPlanSessionProgress(
  plan: PeriodSchedulePlan,
  swapsByPlan: PeriodPlanSwapsByPlan,
  isEntryCompleted: (planId: string, weekNumber: number, day: WeekdayPlanKey) => boolean,
): { completed: number; total: number; pct: number } {
  let completed = 0;
  let total = 0;
  for (const week of plan.weeklyPlans ?? []) {
    const swaps = getSwapsForWeek(swapsByPlan, plan.id, week.weekNumber);
    const days = applyPeriodPlanSwaps(week.days, swaps);
    for (const dayKey of WEEKDAY_PLAN_ORDER) {
      const entry = days[dayKey]?.trim() ?? "";
      if (!entry || isPassivePeriodPlanEntry(entry)) continue;
      total += 1;
      if (isEntryCompleted(plan.id, week.weekNumber, dayKey)) completed += 1;
    }
  }
  return { completed, total, pct: total === 0 ? 0 : Math.round((completed / total) * 100) };
}
