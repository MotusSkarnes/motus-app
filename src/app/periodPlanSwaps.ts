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

export function getPeriodPlanSwapsStorageKey(memberId: string): string {
  return `motus.member.periodPlanSwaps.${memberId}`;
}

export function parsePeriodPlanSwapsState(raw: string | null): PeriodPlanSwapsByPlan {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as PeriodPlanSwapsByPlan;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed;
  } catch {
    return {};
  }
}

export function mergePeriodPlanSwapsStates(...states: PeriodPlanSwapsByPlan[]): PeriodPlanSwapsByPlan {
  const next: PeriodPlanSwapsByPlan = {};
  for (const state of states) {
    if (!state || typeof state !== "object") continue;
    for (const [planId, weeks] of Object.entries(state)) {
      if (!planId.trim() || !weeks || typeof weeks !== "object") continue;
      const nextWeeks = { ...(next[planId] ?? {}) };
      for (const [weekNumber, swaps] of Object.entries(weeks)) {
        if (!weekNumber.trim() || !Array.isArray(swaps)) continue;
        if (swaps.length === 0) {
          delete nextWeeks[weekNumber];
        } else {
          nextWeeks[weekNumber] = swaps;
        }
      }
      if (Object.keys(nextWeeks).length > 0) {
        next[planId] = nextWeeks;
      } else {
        delete next[planId];
      }
    }
  }
  return next;
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
