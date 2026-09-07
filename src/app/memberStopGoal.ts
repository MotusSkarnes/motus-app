import { parsePersonalGoalsJson, PROFILE_METRICS_PREFIX } from "./memberProfilePayload";

export const MEMBER_STOP_GOAL_OPTIONS = ["Snus", "Godteri", "Sukker", "Røyk", "Alkohol", "Energidrikk", "Brus"] as const;

export type MemberStopGoal = {
  target: string;
  customTarget: string;
  /** Journey start — used for total days without. Never moves on break. */
  startedAt: string;
  /**
   * Optional legacy field kept for older clients. Breaks no longer move the streak;
   * if present and earlier than startedAt we prefer it for total days.
   */
  originalStartedAt?: string;
  breakCount?: number;
};

export type StopGoalProgress = {
  totalDays: number;
  breakCount: number;
  /** Estimated clean days = max(0, totalDays - breakCount). */
  cleanDays: number;
  /** Share of journey that is clean days (0–1). */
  cleanRatio: number;
};

export function toLocalDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function normalizeDateKey(value: unknown): string {
  const trimmed = String(value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return "";
  const parsed = new Date(`${trimmed}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return "";
  return toLocalDateKey(parsed) === trimmed ? trimmed : "";
}

function shiftDateKey(dateKey: string, deltaDays: number): string {
  const normalized = normalizeDateKey(dateKey);
  if (!normalized) return "";
  const [year, month, day] = normalized.split("-").map(Number);
  const next = new Date(year, month - 1, day + deltaDays);
  return toLocalDateKey(next);
}

/** Prefer earliest known start so total days keep growing after breaks. */
export function resolveStopGoalJourneyStart(goal: Pick<MemberStopGoal, "startedAt" | "originalStartedAt" | "breakCount">): string {
  const startedAt = normalizeDateKey(goal.startedAt);
  const original = normalizeDateKey(goal.originalStartedAt);
  if (original && startedAt) return original < startedAt ? original : startedAt;
  if (original) return original;
  if (!startedAt) return "";
  // Recover approximate journey start for goals that previously lost days on each break.
  const breaks = Math.max(0, Math.floor(Number(goal.breakCount ?? 0)));
  if (breaks <= 0) return startedAt;
  return shiftDateKey(startedAt, -breaks) || startedAt;
}

export function normalizeStopGoal(value: unknown): MemberStopGoal | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<MemberStopGoal>;
  const target = String(raw.target ?? "").trim();
  const customTarget = String(raw.customTarget ?? "").trim();
  const startedAt = normalizeDateKey(raw.startedAt);
  if (!target && !customTarget) return null;
  const breakCount = Math.max(0, Math.floor(Number(raw.breakCount ?? 0)));
  const originalStartedAt = normalizeDateKey(raw.originalStartedAt) || undefined;
  const journeyStart = resolveStopGoalJourneyStart({ startedAt, originalStartedAt, breakCount });
  return {
    target,
    customTarget,
    startedAt: journeyStart || startedAt,
    originalStartedAt: journeyStart || originalStartedAt,
    breakCount,
  };
}

export function stopGoalIdentity(goal: MemberStopGoal): string {
  return `${goal.target.trim().toLocaleLowerCase("nb-NO")}|${goal.customTarget.trim().toLocaleLowerCase("nb-NO")}`;
}

export function normalizeStopGoals(value: unknown): MemberStopGoal[] {
  if (!Array.isArray(value)) {
    const single = normalizeStopGoal(value);
    return single ? [single] : [];
  }
  const order: string[] = [];
  const byIdentity = new Map<string, MemberStopGoal>();
  for (const item of value) {
    const normalized = normalizeStopGoal(item);
    if (!normalized) continue;
    const key = stopGoalIdentity(normalized);
    if (!byIdentity.has(key)) order.push(key);
    const existing = byIdentity.get(key);
    if (!existing) {
      byIdentity.set(key, normalized);
      continue;
    }
    const journeyA = resolveStopGoalJourneyStart(existing);
    const journeyB = resolveStopGoalJourneyStart(normalized);
    const earliest = !journeyA || (journeyB && journeyB < journeyA) ? journeyB : journeyA;
    byIdentity.set(key, {
      ...normalized,
      target: existing.target || normalized.target,
      customTarget: existing.customTarget || normalized.customTarget,
      breakCount: Math.max(existing.breakCount ?? 0, normalized.breakCount ?? 0),
      startedAt: earliest || normalized.startedAt || existing.startedAt,
      originalStartedAt: earliest || normalized.originalStartedAt || existing.originalStartedAt,
    });
  }
  return order.map((key) => byIdentity.get(key)!);
}

export function getStopGoalFromPersonalGoals(personalGoals: string | undefined): MemberStopGoal | null {
  return getStopGoalsFromPersonalGoals(personalGoals)[0] ?? null;
}

export function getStopGoalsFromPersonalGoals(personalGoals: string | undefined): MemberStopGoal[] {
  const payload = parsePersonalGoalsJson(personalGoals);
  if (!payload) return [];
  const stopGoals = normalizeStopGoals(payload.stopGoals);
  if (stopGoals.length) return stopGoals;
  return normalizeStopGoals(payload.stopGoal);
}

/** Collect stop goals from every candidate profile blob (duplicate member rows). */
export function mergeStopGoalsAcrossCandidates(candidates: Array<string | undefined | null>): MemberStopGoal[] {
  const collected: MemberStopGoal[] = [];
  for (const value of candidates) {
    collected.push(...getStopGoalsFromPersonalGoals(String(value ?? "")));
  }
  return normalizeStopGoals(collected);
}

export function mergeStopGoalsIntoPersonalGoals(
  personalGoals: string,
  stopGoals: MemberStopGoal[],
): string {
  const normalized = normalizeStopGoals(stopGoals);
  if (!normalized.length) return personalGoals;
  const existing = getStopGoalsFromPersonalGoals(personalGoals);
  if (JSON.stringify(existing) === JSON.stringify(normalized)) return personalGoals;
  const parsed = parsePersonalGoalsJson(personalGoals) ?? {};
  return `${PROFILE_METRICS_PREFIX}${JSON.stringify({
    ...parsed,
    stopGoal: normalized[0],
    stopGoals: normalized,
  })}`;
}

export function resolveStopGoalLabel(stopGoal: MemberStopGoal | null): string {
  if (!stopGoal) return "";
  return stopGoal.customTarget.trim() || stopGoal.target.trim();
}

export function formatStopGoalTitle(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) return "";
  if (trimmed.toLocaleLowerCase("nb-NO").endsWith("stopp")) return trimmed;
  if (trimmed.toLocaleLowerCase("nb-NO") === "røyk") return "Røykestopp";
  return `${trimmed}stopp`;
}

export function formatStopGoalWithoutLabel(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) return "";
  const withoutSuffix = trimmed.toLocaleLowerCase("nb-NO").endsWith("stopp")
    ? trimmed.slice(0, -5).trim()
    : trimmed;
  return withoutSuffix.toLocaleLowerCase("nb-NO");
}

export function computeStopGoalDays(startedAt: string, now = new Date()): number {
  const normalized = normalizeDateKey(startedAt);
  if (!normalized) return 0;
  const [year, month, day] = normalized.split("-").map(Number);
  const start = new Date(year, month - 1, day);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.floor((today.getTime() - start.getTime()) / 86_400_000);
  return Math.max(0, diffDays);
}

export function computeStopGoalProgress(goal: MemberStopGoal, now = new Date()): StopGoalProgress {
  const totalDays = computeStopGoalDays(resolveStopGoalJourneyStart(goal), now);
  const breakCount = Math.max(0, Math.floor(Number(goal.breakCount ?? 0)));
  const cleanDays = Math.max(0, totalDays - breakCount);
  const denominator = cleanDays + breakCount;
  return {
    totalDays,
    breakCount,
    cleanDays,
    cleanRatio: denominator > 0 ? cleanDays / denominator : 1,
  };
}

/** Register a slip: only increments break count. Total days since start keep counting. */
export function recordStopGoalBreak(stopGoal: MemberStopGoal, now = new Date()): MemberStopGoal {
  // Prefer already-normalized journey start. Do not re-apply legacy break recovery here.
  const journeyStart =
    normalizeDateKey(stopGoal.originalStartedAt) ||
    normalizeDateKey(stopGoal.startedAt) ||
    toLocalDateKey(now);
  return {
    ...stopGoal,
    startedAt: journeyStart,
    originalStartedAt: journeyStart,
    breakCount: Math.max(0, Number(stopGoal.breakCount ?? 0)) + 1,
  };
}

export function formatStopGoalBreakCount(count: number): string {
  const safe = Math.max(0, Math.floor(count));
  return `${safe} ${safe === 1 ? "brudd" : "brudd"}`;
}

export function formatStopGoalRatioSummary(progress: StopGoalProgress): string {
  if (progress.breakCount <= 0) {
    return progress.totalDays > 0 ? "Ingen brudd — sterkt holdt!" : "Startet i dag · telleren vokser i morgen";
  }
  if (progress.cleanDays <= 0) {
    return `${formatStopGoalBreakCount(progress.breakCount)} · bygg opp dager uten`;
  }
  const perBreak = progress.cleanDays / progress.breakCount;
  if (perBreak >= 10) {
    return `Ca. ${Math.round(perBreak)} dager uten per brudd — imponerende`;
  }
  return `${progress.cleanDays} dager uten · ${formatStopGoalBreakCount(progress.breakCount)}`;
}
