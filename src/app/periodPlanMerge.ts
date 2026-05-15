import type { PeriodSchedulePlan, WeeklyDayPlan, WeeklySchedulePlan } from "./types";

export type PeriodPlanWeekNavItem = {
  id: string;
  weekNumber: number;
  /** Fargedot for felles dagplan mellom flere uker (trener/ medlem navigator). */
  planGroupColor?: string;
};

export const PERIOD_PLAN_GROUP_PRESETS = [
  { key: "rose", label: "Rosa", color: "#f472b6" },
  { key: "teal", label: "Turkis", color: "#14b8a6" },
  { key: "lime", label: "Lime", color: "#84cc16" },
  { key: "amber", label: "Rav", color: "#f59e0b" },
  { key: "violet", label: "Fiolett", color: "#a78bfa" },
] as const satisfies ReadonlyArray<{ key: string; label: string; color: string }>;

export type PeriodPlanGroupPresetKey = (typeof PERIOD_PLAN_GROUP_PRESETS)[number]["key"];

/** Fyllfarge på merket uke på navigatoren — undefined når ukens plan er kun for seg selv. */
export function planGroupColorForKey(planGroupKey: string | undefined): string | undefined {
  if (!planGroupKey?.trim()) return undefined;
  return PERIOD_PLAN_GROUP_PRESETS.find((preset) => preset.key === planGroupKey.trim())?.color;
}

/**
 * Setter planGroupKey på én uke og synkroniserer dagplan innen gruppa (lavt ukenummer først ved sammenslåing).
 */
export function assignWeekPlanGroupAndSyncDays(
  weeks: WeeklySchedulePlan[],
  weekId: string,
  newGroupKey: string | undefined,
): WeeklySchedulePlan[] {
  const trimmedKey = newGroupKey?.trim() || undefined;
  const next: WeeklySchedulePlan[] = weeks.map((week) => {
    if (week.id !== weekId) return week;
    if (!trimmedKey) {
      const cleared = { ...week };
      delete cleared.planGroupKey;
      return cleared;
    }
    return { ...week, planGroupKey: trimmedKey };
  });

  if (!trimmedKey) return next;

  const inGroup = next
    .filter((week) => (week.planGroupKey?.trim() || undefined) === trimmedKey)
    .slice()
    .sort((a, b) => a.weekNumber - b.weekNumber);

  const canonical = inGroup[0];
  if (!canonical) return next;
  const days = { ...canonical.days };
  return next.map((week) =>
    (week.planGroupKey?.trim() || undefined) === trimmedKey ? { ...week, days: { ...days } } : week,
  );
}

/** Etter dagendring i én uke: kopier hele ukens dagplan til alle uker som deler samme planGroupKey. */
export function propagatePlanGroupDaysFromWeek(weeks: WeeklySchedulePlan[], leaderWeekId: string): WeeklySchedulePlan[] {
  const leader = weeks.find((week) => week.id === leaderWeekId);
  if (!leader) return weeks;
  const key = leader.planGroupKey?.trim();
  if (!key) return weeks;
  const days = { ...leader.days };
  return weeks.map((week) =>
    (week.planGroupKey?.trim() || undefined) === key ? { ...week, days: { ...days } } : week,
  );
}

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
    const groupKey = existing?.planGroupKey?.trim();
    return {
      id: existing?.id ?? `${planId}-week-${weekNumber}`,
      weekNumber,
      planGroupColor: planGroupColorForKey(groupKey),
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
    const groupKey =
      typeof existing?.planGroupKey === "string" && existing.planGroupKey.trim()
        ? existing.planGroupKey.trim()
        : undefined;
    const base: WeeklySchedulePlan = {
      id: existing?.id ?? `${plan.id}-week-${weekNumber}`,
      weekNumber,
      days: existing?.days ?? createEmptyWeeklyDayPlan(),
      ...(groupKey ? { planGroupKey: groupKey } : {}),
    };
    return base;
  });
  const synced = normalizeSharedPlanDaysInWeeklyPlans(weeklyPlansRaw);
  return { ...plan, weeks, weeklyPlans: synced };
}

/** Flett inn identisk dagplan for alle «grupperte» uker før lagring/visning — brukes etter hydrate. */
export function normalizeSharedPlanDaysInWeeklyPlans(weeklyPlans: WeeklySchedulePlan[]): WeeklySchedulePlan[] {
  const keys = new Set<string>();
  for (const week of weeklyPlans) {
    const key = week.planGroupKey?.trim();
    if (key) keys.add(key);
  }
  let result = [...weeklyPlans];
  for (const key of keys) {
    const inGroup = result
      .filter((week) => (week.planGroupKey?.trim() || "") === key)
      .slice()
      .sort((a, b) => a.weekNumber - b.weekNumber);
    const canonical = inGroup[0];
    if (!canonical) continue;
    const days = { ...canonical.days };
    result = result.map((week) =>
      (week.planGroupKey?.trim() || "") === key ? { ...week, days: { ...days } } : week,
    );
  }
  return result;
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
