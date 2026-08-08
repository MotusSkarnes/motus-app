import { parsePersonalGoalsJson } from "./memberProfilePayload";

export const MEMBER_STOP_GOAL_OPTIONS = ["Snus", "Godteri", "Sukker", "Røyk", "Alkohol", "Energidrikk", "Brus"] as const;

export type MemberStopGoal = {
  target: string;
  customTarget: string;
  startedAt: string;
  breakCount?: number;
};

export type StopGoalSaveQueue = {
  tail: Promise<void>;
};

export function enqueueStopGoalSave(
  queue: StopGoalSaveQueue,
  save: () => Promise<void>,
  onQueueDrained: () => void,
): Promise<void> {
  const queued = queue.tail.catch(() => undefined).then(() => save());
  const settled = queued.catch(() => undefined);
  queue.tail = settled;
  void settled.finally(() => {
    if (queue.tail === settled) onQueueDrained();
  });
  return settled;
}

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

export function normalizeStopGoal(value: unknown): MemberStopGoal | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<MemberStopGoal>;
  const target = String(raw.target ?? "").trim();
  const customTarget = String(raw.customTarget ?? "").trim();
  const startedAt = normalizeDateKey(raw.startedAt);
  if (!target && !customTarget) return null;
  const breakCount = Math.max(0, Math.floor(Number(raw.breakCount ?? 0)));
  return {
    target,
    customTarget,
    startedAt,
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
    const preferCurrent =
      (normalized.breakCount ?? 0) > (existing.breakCount ?? 0) ||
      ((normalized.breakCount ?? 0) === (existing.breakCount ?? 0) &&
        normalized.startedAt.localeCompare(existing.startedAt) > 0);
    byIdentity.set(key, preferCurrent ? normalized : existing);
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

function advanceDateKeyByOneDay(dateKey: string, now = new Date()): string {
  const normalized = normalizeDateKey(dateKey);
  if (!normalized) return toLocalDateKey(now);
  const [year, month, day] = normalized.split("-").map(Number);
  const next = new Date(year, month - 1, day + 1);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (next.getTime() > today.getTime()) return toLocalDateKey(today);
  return toLocalDateKey(next);
}

/** Register a slip: subtract one day from the streak and increment break count. */
export function recordStopGoalBreak(stopGoal: MemberStopGoal, now = new Date()): MemberStopGoal {
  const startedAt = normalizeDateKey(stopGoal.startedAt) || toLocalDateKey(now);
  const days = computeStopGoalDays(startedAt, now);
  return {
    ...stopGoal,
    startedAt: days > 0 ? advanceDateKeyByOneDay(startedAt, now) : startedAt,
    breakCount: Math.max(0, Number(stopGoal.breakCount ?? 0)) + 1,
  };
}

export function formatStopGoalBreakCount(count: number): string {
  const safe = Math.max(0, Math.floor(count));
  return `${safe} ${safe === 1 ? "brudd" : "brudd"}`;
}
