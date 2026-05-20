import { WEEKDAY_PLAN_ORDER } from "./periodPlanSwaps";
import type { PeriodSchedulePlan, WeekdayPlanKey, WeeklyDayPlan, WeeklySchedulePlan } from "./types";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Hele dager fra planstart (dag 0 = startdato = «mandag»-kolonnen i ukevisningen). */
export function periodPlanDaysSinceStart(startDate: Date, targetDate: Date): number {
  const startMs = startOfLocalDay(startDate).getTime();
  const targetMs = startOfLocalDay(targetDate).getTime();
  return Math.floor((targetMs - startMs) / MS_PER_DAY);
}

/** Kolonnenøkkel for en kalenderdag — samme logikk som `resolvePeriodPlanEntryDate` i portalen. */
export function periodPlanWeekdayKeyForDate(startDate: Date, targetDate: Date): WeekdayPlanKey | null {
  const daysSinceStart = periodPlanDaysSinceStart(startDate, targetDate);
  if (daysSinceStart < 0) return null;
  return WEEKDAY_PLAN_ORDER[daysSinceStart % 7];
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
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const parsed = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
  }
  const parts = value.split(".");
  if (parts.length >= 3) {
    const day = Number(parts[0]);
    const month = Number(parts[1]) - 1;
    const year = Number(parts[2]);
    const parsed = new Date(year, month, day);
    return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
  }
  const fallback = new Date(value);
  return Number.isNaN(fallback.getTime()) ? 0 : fallback.getTime();
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
  return { ...plan, weeks, weeklyPlans: synced };
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
