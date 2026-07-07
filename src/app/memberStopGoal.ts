import { parsePersonalGoalsJson } from "./memberProfilePayload";

export const MEMBER_STOP_GOAL_OPTIONS = ["Snus", "Godteri", "Sukker", "Røyk", "Alkohol", "Energidrikk", "Brus"] as const;

export type MemberStopGoal = {
  target: string;
  customTarget: string;
  startedAt: string;
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

export function normalizeStopGoal(value: unknown): MemberStopGoal | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<MemberStopGoal>;
  const target = String(raw.target ?? "").trim();
  const customTarget = String(raw.customTarget ?? "").trim();
  const startedAt = normalizeDateKey(raw.startedAt);
  if (!target && !customTarget) return null;
  return {
    target,
    customTarget,
    startedAt,
  };
}

export function normalizeStopGoals(value: unknown): MemberStopGoal[] {
  if (!Array.isArray(value)) {
    const single = normalizeStopGoal(value);
    return single ? [single] : [];
  }
  const seen = new Set<string>();
  return value.reduce<MemberStopGoal[]>((items, item) => {
    const normalized = normalizeStopGoal(item);
    if (!normalized) return items;
    const key = `${normalized.target.toLocaleLowerCase("nb-NO")}|${normalized.customTarget.toLocaleLowerCase("nb-NO")}|${normalized.startedAt}`;
    if (seen.has(key)) return items;
    seen.add(key);
    items.push(normalized);
    return items;
  }, []);
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

export function computeStopGoalDays(startedAt: string, now = new Date()): number {
  const normalized = normalizeDateKey(startedAt);
  if (!normalized) return 0;
  const [year, month, day] = normalized.split("-").map(Number);
  const start = new Date(year, month - 1, day);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.floor((today.getTime() - start.getTime()) / 86_400_000);
  return Math.max(0, diffDays);
}
