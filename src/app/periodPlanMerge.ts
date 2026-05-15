import type { PeriodSchedulePlan, WeeklyDayPlan, WeeklySchedulePlan } from "./types";

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
