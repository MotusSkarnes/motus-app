import { PROFILE_METRICS_PREFIX, parsePersonalGoalsJson } from "./memberProfilePayload";
import type { WeekdayPlanKey, WeeklyDayPlan } from "./types";

export const WEEKDAY_PLAN_ORDER: WeekdayPlanKey[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

export const WEEKDAY_PLAN_LABELS: Record<WeekdayPlanKey, string> = {
  monday: "Mandag",
  tuesday: "Tirsdag",
  wednesday: "Onsdag",
  thursday: "Torsdag",
  friday: "Fredag",
  saturday: "Lørdag",
  sunday: "Søndag",
};

export type PeriodPlanDaySwap = {
  dayA: WeekdayPlanKey;
  dayB: WeekdayPlanKey;
  /** Uten mode = eldre lagret bytte. */
  mode?: "swap" | "move" | "set";
  values?: Partial<WeeklyDayPlan>;
};

/** planId -> weekNumber -> swaps */
export type PeriodPlanSwapsByPlan = Record<string, Record<string, PeriodPlanDaySwap[]>>;

export const PERIOD_PLAN_SWAP_PREFS_VERSION = 1;

export type PeriodPlanSwapPrefs = {
  version: typeof PERIOD_PLAN_SWAP_PREFS_VERSION;
  swapsByPlan: PeriodPlanSwapsByPlan;
  updatedAt: number;
};

export function getPeriodPlanSwapsStorageKey(memberId: string): string {
  return `motus.member.periodPlanSwaps.${memberId}`;
}

export function parsePeriodPlanSwapsState(raw: string | null): PeriodPlanSwapsByPlan {
  if (!raw) return {};
  try {
    return normalizePeriodPlanSwapsByPlan(JSON.parse(raw) as unknown);
  } catch {
    return {};
  }
}

function normalizeDayKey(value: unknown): WeekdayPlanKey | null {
  return typeof value === "string" && WEEKDAY_PLAN_ORDER.includes(value as WeekdayPlanKey)
    ? (value as WeekdayPlanKey)
    : null;
}

function normalizePeriodPlanDaySwap(raw: unknown): PeriodPlanDaySwap | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const dayA = normalizeDayKey(record.dayA);
  const dayB = normalizeDayKey(record.dayB);
  if (!dayA || !dayB) return null;
  const mode = record.mode === "move" || record.mode === "set" || record.mode === "swap" ? record.mode : undefined;
  const values: Partial<WeeklyDayPlan> = {};
  if (record.values && typeof record.values === "object") {
    const rawValues = record.values as Record<string, unknown>;
    for (const key of WEEKDAY_PLAN_ORDER) {
      if (Object.prototype.hasOwnProperty.call(rawValues, key)) {
        values[key] = String(rawValues[key] ?? "");
      }
    }
  }
  return {
    dayA,
    dayB,
    ...(mode ? { mode } : {}),
    ...(Object.keys(values).length > 0 ? { values } : {}),
  };
}

export function normalizePeriodPlanSwapsByPlan(raw: unknown): PeriodPlanSwapsByPlan {
  if (!raw || typeof raw !== "object") return {};
  const next: PeriodPlanSwapsByPlan = {};
  for (const [planId, weeks] of Object.entries(raw as Record<string, unknown>)) {
    const trimmedPlanId = planId.trim();
    if (!trimmedPlanId || !weeks || typeof weeks !== "object") continue;
    const normalizedWeeks: Record<string, PeriodPlanDaySwap[]> = {};
    for (const [weekNumber, swaps] of Object.entries(weeks as Record<string, unknown>)) {
      const normalizedSwaps = Array.isArray(swaps)
        ? swaps.map(normalizePeriodPlanDaySwap).filter((item): item is PeriodPlanDaySwap => item !== null)
        : [];
      if (normalizedSwaps.length > 0) {
        normalizedWeeks[String(weekNumber)] = normalizedSwaps;
      }
    }
    if (Object.keys(normalizedWeeks).length > 0) {
      next[trimmedPlanId] = normalizedWeeks;
    }
  }
  return next;
}

function normalizePeriodPlanSwapPrefs(raw: unknown): PeriodPlanSwapPrefs | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  if (Number(record.version) !== PERIOD_PLAN_SWAP_PREFS_VERSION) return null;
  return {
    version: PERIOD_PLAN_SWAP_PREFS_VERSION,
    swapsByPlan: normalizePeriodPlanSwapsByPlan(record.swapsByPlan),
    updatedAt: Number(record.updatedAt) || 0,
  };
}

export function readPeriodPlanSwapsFromPersonalGoals(personalGoals: string | undefined): PeriodPlanSwapPrefs | null {
  const payload = parsePersonalGoalsJson(personalGoals);
  if (!payload) return null;
  return normalizePeriodPlanSwapPrefs(payload.periodPlanSwaps);
}

export function mergePeriodPlanSwapsIntoPersonalGoals(
  existingPersonalGoals: string | undefined,
  prefs: PeriodPlanSwapPrefs,
): string {
  const existing = parsePersonalGoalsJson(existingPersonalGoals) ?? {};
  const updatedAt = Number.isFinite(prefs.updatedAt) && prefs.updatedAt > 0 ? prefs.updatedAt : Date.now();
  const payload = {
    ...existing,
    periodPlanSwaps: {
      version: PERIOD_PLAN_SWAP_PREFS_VERSION,
      swapsByPlan: normalizePeriodPlanSwapsByPlan(prefs.swapsByPlan),
      updatedAt,
    },
  };
  return `${PROFILE_METRICS_PREFIX}${JSON.stringify(payload)}`;
}

export function mergePeriodPlanSwapPrefs(
  local: PeriodPlanSwapPrefs,
  remote: PeriodPlanSwapPrefs | null | undefined,
): PeriodPlanSwapPrefs {
  const localSwapsByPlan = normalizePeriodPlanSwapsByPlan(local.swapsByPlan);
  if (!remote) {
    return {
      ...local,
      swapsByPlan: localSwapsByPlan,
    };
  }
  const remoteSwapsByPlan = normalizePeriodPlanSwapsByPlan(remote.swapsByPlan);
  const useRemoteBase = remote.updatedAt > local.updatedAt;
  const base = useRemoteBase ? remoteSwapsByPlan : localSwapsByPlan;
  const other = useRemoteBase ? localSwapsByPlan : remoteSwapsByPlan;
  const merged: PeriodPlanSwapsByPlan = {};
  for (const [planId, weeks] of Object.entries(base)) {
    merged[planId] = { ...weeks };
  }
  for (const [planId, weeks] of Object.entries(other)) {
    const mergedWeeks = { ...(merged[planId] ?? {}) };
    for (const [weekNumber, swaps] of Object.entries(weeks)) {
      if (!Object.prototype.hasOwnProperty.call(mergedWeeks, weekNumber)) {
        mergedWeeks[weekNumber] = swaps;
      }
    }
    if (Object.keys(mergedWeeks).length > 0) {
      merged[planId] = mergedWeeks;
    }
  }
  return {
    version: PERIOD_PLAN_SWAP_PREFS_VERSION,
    swapsByPlan: merged,
    updatedAt: Math.max(local.updatedAt, remote.updatedAt),
  };
}

export function getSwapsForWeek(
  swapsByPlan: PeriodPlanSwapsByPlan,
  planId: string,
  weekNumber: number,
): PeriodPlanDaySwap[] {
  return swapsByPlan[planId]?.[String(weekNumber)] ?? [];
}

export function applyPeriodPlanSwaps(days: WeeklyDayPlan, swaps: PeriodPlanDaySwap[]): WeeklyDayPlan {
  const next: WeeklyDayPlan = { ...days };
  for (const swap of swaps) {
    if (swap.mode === "set") {
      Object.assign(next, swap.values ?? {});
    } else if (swap.mode === "move") {
      next[swap.dayB] = next[swap.dayA];
      next[swap.dayA] = "";
    } else {
      const valueA = next[swap.dayA];
      const valueB = next[swap.dayB];
      next[swap.dayA] = valueB;
      next[swap.dayB] = valueA;
    }
  }
  return next;
}

export function buildPeriodPlanWeekOverride(
  originalDays: WeeklyDayPlan,
  nextDays: WeeklyDayPlan,
  dayA: WeekdayPlanKey,
  dayB: WeekdayPlanKey,
): PeriodPlanDaySwap[] {
  const values: Partial<WeeklyDayPlan> = {};
  for (const key of WEEKDAY_PLAN_ORDER) {
    if ((originalDays[key] ?? "") !== (nextDays[key] ?? "")) {
      values[key] = nextDays[key] ?? "";
    }
  }
  return Object.keys(values).length > 0 ? [{ dayA, dayB, mode: "set", values }] : [];
}

function changeTouchesDay(change: PeriodPlanDaySwap, dayA: WeekdayPlanKey, dayB: WeekdayPlanKey): boolean {
  return change.dayA === dayA || change.dayA === dayB || change.dayB === dayA || change.dayB === dayB;
}

export function togglePeriodPlanSwap(
  swaps: PeriodPlanDaySwap[],
  dayA: WeekdayPlanKey,
  dayB: WeekdayPlanKey,
): PeriodPlanDaySwap[] {
  if (dayA === dayB) return swaps;
  const existingIndex = swaps.findIndex(
    (swap) =>
      (swap.dayA === dayA && swap.dayB === dayB) ||
      (swap.dayA === dayB && swap.dayB === dayA),
  );
  if (existingIndex >= 0) {
    return swaps.filter((_, index) => index !== existingIndex);
  }
  return [...swaps.filter((swap) => !changeTouchesDay(swap, dayA, dayB)), { dayA, dayB, mode: "swap" }];
}

export function togglePeriodPlanMove(
  swaps: PeriodPlanDaySwap[],
  dayA: WeekdayPlanKey,
  dayB: WeekdayPlanKey,
): PeriodPlanDaySwap[] {
  if (dayA === dayB) return swaps;
  const existingIndex = swaps.findIndex((swap) => swap.mode === "move" && swap.dayA === dayA && swap.dayB === dayB);
  if (existingIndex >= 0) {
    return swaps.filter((_, index) => index !== existingIndex);
  }
  return [...swaps.filter((swap) => !changeTouchesDay(swap, dayA, dayB)), { dayA, dayB, mode: "move" }];
}

export function setSwapsForWeek(
  swapsByPlan: PeriodPlanSwapsByPlan,
  planId: string,
  weekNumber: number,
  swaps: PeriodPlanDaySwap[],
): PeriodPlanSwapsByPlan {
  const weekKey = String(weekNumber);
  const nextPlanWeeks = { ...(swapsByPlan[planId] ?? {}) };
  if (swaps.length === 0) {
    delete nextPlanWeeks[weekKey];
  } else {
    nextPlanWeeks[weekKey] = swaps;
  }
  const next = { ...swapsByPlan };
  if (Object.keys(nextPlanWeeks).length === 0) {
    delete next[planId];
  } else {
    next[planId] = nextPlanWeeks;
  }
  return next;
}

/** Hvilken kalenderdag innholdet på slot opprinnelig tilhørte (før bytter). */
export function periodPlanSourceDay(
  slot: WeekdayPlanKey,
  originalDays: WeeklyDayPlan,
  effectiveDays: WeeklyDayPlan,
): WeekdayPlanKey | null {
  const content = effectiveDays[slot]?.trim() ?? "";
  if (!content) return null;
  const originalOnSlot = originalDays[slot]?.trim() ?? "";
  if (content === originalOnSlot) return null;
  for (const key of WEEKDAY_PLAN_ORDER) {
    if (key === slot) continue;
    if ((originalDays[key]?.trim() ?? "") === content) return key;
  }
  return null;
}
