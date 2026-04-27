import type { PeriodSchedulePlan } from "./types";

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

export function mergedPeriodPlanListForMember(
  relatedMemberIds: string[],
  localByMember: Record<string, PeriodSchedulePlan[]>,
  remoteRows: Array<{ memberId: string; plan: PeriodSchedulePlan }>,
): PeriodSchedulePlan[] {
  const merged = new Map<string, PeriodSchedulePlan>();
  const idSet = new Set(relatedMemberIds.map((id) => id.trim()).filter(Boolean));
  for (const memberId of idSet) {
    for (const plan of localByMember[memberId] ?? []) {
      if (!merged.has(plan.id)) merged.set(plan.id, plan);
    }
  }
  for (const row of remoteRows) {
    if (!idSet.has(row.memberId.trim())) continue;
    merged.set(row.plan.id, row.plan);
  }
  return Array.from(merged.values()).sort((a, b) => planStartTimeMs(b) - planStartTimeMs(a));
}
