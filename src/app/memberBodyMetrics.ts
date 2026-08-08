import {
  PROFILE_METRICS_PREFIX,
  parsePersonalGoalsJson,
  readProfileExtensions,
} from "./memberProfilePayload";
import { getMonthlyCheckInsFromPersonalGoals } from "./memberMonthlyCheckIn";

export const MEMBER_BODY_METRICS_VERSION = 1;
export const MAX_BODY_METRICS_ENTRIES = 120;

export type BodyMetricSource = "member" | "check-in";

export type MemberBodyMetricEntry = {
  version: typeof MEMBER_BODY_METRICS_VERSION;
  id: string;
  /** Local calendar day, YYYY-MM-DD. */
  dateKey: string;
  loggedAt: string;
  weightKg?: number;
  bodyFatPct?: number;
  source: BodyMetricSource;
};

export type BodyMetricChartPoint = {
  dateMs: number;
  dateLabel: string;
  value: number;
  source: BodyMetricSource;
  entryId: string;
};

export type BodyMetricTimeline = {
  weightSeries: BodyMetricChartPoint[];
  bodyFatSeries: BodyMetricChartPoint[];
  entries: MemberBodyMetricEntry[];
};

function startOfDayMs(dateKey: string): number | null {
  const match = dateKey.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day).getTime();
}

function formatDateLabel(dateMs: number): string {
  return new Date(dateMs).toLocaleDateString("nb-NO", { day: "numeric", month: "short", year: "2-digit" });
}

function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function normalizeMetricNumber(value: unknown, max = 500): number | undefined {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0 || n > max) return undefined;
  return Math.round(n * 100) / 100;
}

function normalizeBodyMetricEntry(raw: unknown): MemberBodyMetricEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Partial<MemberBodyMetricEntry>;
  const id = String(data.id ?? "").trim();
  const dateKey = String(data.dateKey ?? "").trim();
  const loggedAt = String(data.loggedAt ?? "").trim();
  const source = data.source === "check-in" ? "check-in" : data.source === "member" ? "member" : null;
  if (!id || !dateKey || !loggedAt || !source) return null;
  const weightKg = normalizeMetricNumber(data.weightKg, 400);
  const bodyFatPct = normalizeMetricNumber(data.bodyFatPct, 100);
  if (weightKg === undefined && bodyFatPct === undefined) return null;
  return {
    version: MEMBER_BODY_METRICS_VERSION,
    id,
    dateKey,
    loggedAt,
    ...(weightKg !== undefined ? { weightKg } : {}),
    ...(bodyFatPct !== undefined ? { bodyFatPct } : {}),
    source,
  };
}

export function getBodyMetricsFromPersonalGoals(personalGoals: string | undefined): MemberBodyMetricEntry[] {
  const payload = parsePersonalGoalsJson(personalGoals);
  if (!payload || !Array.isArray(payload.bodyMetrics)) return [];
  return payload.bodyMetrics
    .map((entry) => normalizeBodyMetricEntry(entry))
    .filter((entry): entry is MemberBodyMetricEntry => Boolean(entry))
    .sort((a, b) => a.loggedAt.localeCompare(b.loggedAt));
}

function entriesFromMonthlyCheckIns(personalGoals: string | undefined): MemberBodyMetricEntry[] {
  return getMonthlyCheckInsFromPersonalGoals(personalGoals).flatMap((checkIn) => {
    const tanita = checkIn.tanitaMetrics ?? {};
    const weightKg = normalizeMetricNumber(tanita.weightKg, 400);
    const bodyFatPct = normalizeMetricNumber(tanita.bodyFatPct, 100);
    if (weightKg === undefined && bodyFatPct === undefined) return [];
    const completedAt = checkIn.completedAt;
    const date = new Date(completedAt);
    const dateKey = Number.isFinite(date.getTime()) ? toDateKey(date) : checkIn.monthKey;
    return [
      {
        version: MEMBER_BODY_METRICS_VERSION,
        id: `check-in-${checkIn.monthKey}`,
        dateKey,
        loggedAt: completedAt,
        ...(weightKg !== undefined ? { weightKg } : {}),
        ...(bodyFatPct !== undefined ? { bodyFatPct } : {}),
        source: "check-in" as const,
      },
    ];
  });
}

function collapseSeriesByDay(
  entries: MemberBodyMetricEntry[],
  metric: "weightKg" | "bodyFatPct",
): BodyMetricChartPoint[] {
  const byDay = new Map<string, MemberBodyMetricEntry>();

  entries.forEach((entry) => {
    const value = entry[metric];
    if (value === undefined) return;
    const existing = byDay.get(entry.dateKey);
    if (!existing) {
      byDay.set(entry.dateKey, entry);
      return;
    }
    if (metric === "bodyFatPct" && entry.source === "check-in" && existing.source !== "check-in") {
      byDay.set(entry.dateKey, entry);
      return;
    }
    if (entry.loggedAt.localeCompare(existing.loggedAt) > 0) {
      byDay.set(entry.dateKey, entry);
    }
  });

  return Array.from(byDay.values())
    .map((entry) => {
      const value = entry[metric];
      if (value === undefined) return null;
      const dateMs = startOfDayMs(entry.dateKey);
      if (dateMs === null) return null;
      return {
        dateMs,
        dateLabel: formatDateLabel(dateMs),
        value,
        source: entry.source,
        entryId: entry.id,
      };
    })
    .filter((point): point is BodyMetricChartPoint => Boolean(point))
    .sort((a, b) => a.dateMs - b.dateMs);
}

export function buildBodyMetricsTimeline(personalGoals: string | undefined): BodyMetricTimeline {
  const memberEntries = getBodyMetricsFromPersonalGoals(personalGoals);
  const checkInEntries = entriesFromMonthlyCheckIns(personalGoals);
  const entries = [...memberEntries, ...checkInEntries].sort((a, b) => a.loggedAt.localeCompare(b.loggedAt));
  return {
    weightSeries: collapseSeriesByDay(entries, "weightKg"),
    bodyFatSeries: collapseSeriesByDay(entries, "bodyFatPct"),
    entries,
  };
}

export function computeMetricChange(series: BodyMetricChartPoint[]): number | null {
  if (series.length < 2) return null;
  const first = series[0].value;
  const latest = series[series.length - 1].value;
  return Math.round((latest - first) * 10) / 10;
}

export type MetricChartGeometry = {
  linePath: string;
  areaPath: string;
  dots: Array<{ x: number; y: number; point: BodyMetricChartPoint }>;
  yTicks: Array<{ y: number; label: string }>;
  xLabels: Array<{ x: number; label: string }>;
};

export function buildMetricChartGeometry(
  points: BodyMetricChartPoint[],
  width: number,
  height: number,
  unit: string,
): MetricChartGeometry | null {
  if (points.length === 0) return null;

  const padLeft = 40;
  const padRight = 12;
  const padTop = 14;
  const padBottom = 28;
  const innerW = Math.max(1, width - padLeft - padRight);
  const innerH = Math.max(1, height - padTop - padBottom);

  const yValues = points.map((p) => p.value);
  let yMin = Math.min(...yValues);
  let yMax = Math.max(...yValues);
  if (yMin === yMax) {
    yMin = Math.max(0, yMin - (unit === "%" ? 2 : 2));
    yMax = yMax + (unit === "%" ? 2 : 2);
  } else {
    const padding = (yMax - yMin) * 0.12;
    yMin = Math.max(0, yMin - padding);
    yMax = yMax + padding;
  }

  const xMin = points[0].dateMs;
  const xMax = points[points.length - 1].dateMs || xMin + 1;
  const xSpan = Math.max(1, xMax - xMin);

  const toX = (dateMs: number) => padLeft + ((dateMs - xMin) / xSpan) * innerW;
  const toY = (value: number) => padTop + innerH - ((value - yMin) / (yMax - yMin)) * innerH;

  const formatTick = (value: number) => {
    const rounded = Math.round(value * 10) / 10;
    return unit === "kg" ? `${rounded} kg` : `${String(rounded).replace(".", ",")} %`;
  };

  const dots = points.map((point) => ({
    x: toX(point.dateMs),
    y: toY(point.value),
    point,
  }));

  const linePath = dots.map((dot, index) => `${index === 0 ? "M" : "L"} ${dot.x.toFixed(1)} ${dot.y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L ${dots[dots.length - 1].x.toFixed(1)} ${(padTop + innerH).toFixed(1)} L ${dots[0].x.toFixed(1)} ${(padTop + innerH).toFixed(1)} Z`;

  const yTicks = [yMin, (yMin + yMax) / 2, yMax].map((value) => ({
    y: toY(value),
    label: formatTick(value),
  }));

  const labelIndexes =
    points.length <= 3 ? points.map((_, index) => index) : [0, Math.floor((points.length - 1) / 2), points.length - 1];
  const xLabels = Array.from(new Set(labelIndexes)).map((index) => ({
    x: toX(points[index].dateMs),
    label: points[index].dateLabel,
  }));

  return { linePath, areaPath, dots, yTicks, xLabels };
}

export function createMemberBodyMetricEntry(input: {
  weightKg?: number;
  bodyFatPct?: number;
  loggedAt?: Date;
}): MemberBodyMetricEntry | null {
  const weightKg = normalizeMetricNumber(input.weightKg, 400);
  const bodyFatPct = normalizeMetricNumber(input.bodyFatPct, 100);
  if (weightKg === undefined && bodyFatPct === undefined) return null;
  const loggedAt = input.loggedAt ?? new Date();
  const dateKey = toDateKey(loggedAt);
  return {
    version: MEMBER_BODY_METRICS_VERSION,
    id: `member-${loggedAt.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
    dateKey,
    loggedAt: loggedAt.toISOString(),
    ...(weightKg !== undefined ? { weightKg } : {}),
    ...(bodyFatPct !== undefined ? { bodyFatPct } : {}),
    source: "member",
  };
}

function buildPayloadFromExisting(existingPersonalGoals: string | undefined, bodyMetrics: MemberBodyMetricEntry[]): string {
  const existing = parsePersonalGoalsJson(existingPersonalGoals) ?? {};
  const profileExtensions = readProfileExtensions(existingPersonalGoals);
  const payload = {
    sessionsPerWeekTarget: String(existing.sessionsPerWeekTarget ?? ""),
    dailyStepsTarget: String(existing.dailyStepsTarget ?? ""),
    targetWeight: String(existing.targetWeight ?? ""),
    currentDailySteps: String(existing.currentDailySteps ?? ""),
    ...(existing.homeVisibility && typeof existing.homeVisibility === "object"
      ? { homeVisibility: existing.homeVisibility }
      : {}),
    ...(Array.isArray(existing.favoritePersonalRecords)
      ? { favoritePersonalRecords: existing.favoritePersonalRecords }
      : {}),
    ...(existing.notificationPreferences && typeof existing.notificationPreferences === "object"
      ? { notificationPreferences: existing.notificationPreferences }
      : {}),
    ...(existing.foodAvoidances && typeof existing.foodAvoidances === "object"
      ? { foodAvoidances: existing.foodAvoidances }
      : {}),
    ...(existing.memberAppUi && typeof existing.memberAppUi === "object" ? { memberAppUi: existing.memberAppUi } : {}),
    ...(existing.onboarding && typeof existing.onboarding === "object" ? { onboarding: existing.onboarding } : {}),
    ...(String(existing.onboardingCompletedAt ?? "").trim()
      ? { onboardingCompletedAt: String(existing.onboardingCompletedAt) }
      : {}),
    ...(Array.isArray(existing.monthlyCheckIns) ? { monthlyCheckIns: existing.monthlyCheckIns } : {}),
    ...profileExtensions,
    bodyMetrics,
  };
  return `${PROFILE_METRICS_PREFIX}${JSON.stringify(payload)}`;
}

export function mergeBodyMetricIntoPersonalGoals(
  existingPersonalGoals: string | undefined,
  entry: MemberBodyMetricEntry,
): string {
  const previous = getBodyMetricsFromPersonalGoals(existingPersonalGoals);
  const withoutSameDayMember =
    entry.source === "member"
      ? previous.filter((row) => !(row.source === "member" && row.dateKey === entry.dateKey))
      : previous;
  const next = [entry, ...withoutSameDayMember].slice(0, MAX_BODY_METRICS_ENTRIES);
  return buildPayloadFromExisting(existingPersonalGoals, next);
}

export function bodyMetricSourceLabel(source: BodyMetricSource): string {
  return source === "check-in" ? "Tanita (sjekk-inn)" : "Egen logging";
}
