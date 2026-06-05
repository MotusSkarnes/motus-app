import type { PeriodSchedulePlan } from "./types";

const PERIOD_PLAN_ROWS_CACHE_KEY = "motus.member.cachedPeriodPlanRows.v1";
const HOME_WORKOUT_SNAPSHOT_KEY = "motus.member.homeWorkoutSnapshot.v1";
const NO_PLAN_COVER_URL_CACHE_KEY = "motus.member.noPlanCoverUrl.v1";

export type MemberPeriodPlanRow = { memberId: string; plan: PeriodSchedulePlan };

export type MemberHomeWorkoutSnapshot = {
  dateKey: string;
  title: string;
  imageSrc: string | null;
  isPassiveDay: boolean;
  isNoPlanDay?: boolean;
};

export function memberLocalDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function readCachedMemberPeriodPlanRows(): MemberPeriodPlanRow[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(PERIOD_PLAN_ROWS_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as MemberPeriodPlanRow[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeCachedMemberPeriodPlanRows(rows: MemberPeriodPlanRow[]): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(PERIOD_PLAN_ROWS_CACHE_KEY, JSON.stringify(rows));
  } catch {
    // ignore quota / privacy mode
  }
}

export function readMemberHomeWorkoutSnapshot(): MemberHomeWorkoutSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(HOME_WORKOUT_SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MemberHomeWorkoutSnapshot;
    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.dateKey !== "string" || typeof parsed.title !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeMemberHomeWorkoutSnapshot(snapshot: MemberHomeWorkoutSnapshot): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(HOME_WORKOUT_SNAPSHOT_KEY, JSON.stringify(snapshot));
  } catch {
    // ignore
  }
}

export function readCachedNoPlanDayCoverUrl(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(NO_PLAN_COVER_URL_CACHE_KEY);
    const trimmed = raw?.trim();
    return trimmed || null;
  } catch {
    return null;
  }
}

export function writeCachedNoPlanDayCoverUrl(imageUrl: string | null | undefined): void {
  if (typeof window === "undefined") return;
  try {
    const trimmed = imageUrl?.trim();
    if (!trimmed) {
      window.sessionStorage.removeItem(NO_PLAN_COVER_URL_CACHE_KEY);
      return;
    }
    window.sessionStorage.setItem(NO_PLAN_COVER_URL_CACHE_KEY, trimmed);
  } catch {
    // ignore
  }
}

export function clearMemberSessionCaches(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(PERIOD_PLAN_ROWS_CACHE_KEY);
    window.sessionStorage.removeItem(HOME_WORKOUT_SNAPSHOT_KEY);
    window.sessionStorage.removeItem(NO_PLAN_COVER_URL_CACHE_KEY);
  } catch {
    // ignore
  }
}
