import { getWeekKey } from "./memberProgressGamification";
import type { WorkoutReflection } from "./types";

export type ScoreTrend = "up" | "down" | "flat";

export type MomentumScore = {
  pct: number;
  trend: ScoreTrend;
  subline: string;
  /** Weekly session counts for sparkline (oldest → newest). */
  sparkPoints: number[];
};

export type ConsistencyScore = {
  pct: number;
  subline: string;
};

export type WeeklyScore = {
  score: number;
  maxScore: number;
  pct: number;
  subline: string;
};

export type RecoveryScore = {
  pct: number | null;
  subline: string;
};

export type MemberXpState = {
  totalXp: number;
  level: number;
  levelLabel: string;
  xpInLevel: number;
  xpForNextLevel: number;
  pctToNext: number;
};

export type MemberProgressScores = {
  momentum: MomentumScore;
  consistency: ConsistencyScore;
  weekly: WeeklyScore;
  recovery: RecoveryScore;
  xp: MemberXpState;
};

const XP_LEVEL_THRESHOLDS = [0, 300, 750, 1400, 2300, 3500, 5000, 6800, 8900, 11200, 13800, 16700, 20000];

const XP_LEVEL_LABELS = [
  "Nybegynner",
  "I gang",
  "Jevn",
  "Motivert",
  "Dedikert",
  "Sterk",
  "Konsekvent",
  "Erfaren",
  "Avansert",
  "Elite",
  "Mester",
  "Legende",
  "Motus-pro",
] as const;

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7;
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return d;
}

function countWorkoutsBetween(dates: Date[], start: Date, end: Date): number {
  const startMs = start.getTime();
  const endMs = end.getTime();
  return dates.filter((date) => {
    const t = date.getTime();
    return t >= startMs && t < endMs;
  }).length;
}

function buildMomentumSparkPoints(completedLogDates: Date[], nowDate: Date, windows = 6): number[] {
  const today = new Date(nowDate);
  today.setHours(0, 0, 0, 0);
  const points: number[] = [];
  for (let index = windows - 1; index >= 0; index -= 1) {
    const end = new Date(today);
    end.setDate(today.getDate() + 1 - index * 7);
    const start = new Date(end);
    start.setDate(end.getDate() - 7);
    points.push(countWorkoutsBetween(completedLogDates, start, end));
  }
  return points;
}

export function getXpLevelLabel(level: number): string {
  const index = Math.max(0, Math.min(XP_LEVEL_LABELS.length - 1, level - 1));
  return XP_LEVEL_LABELS[index];
}

export function computeMomentumScore(input: {
  completedLogDates: Date[];
  nowDate: Date;
  /** @deprecated Ikke lenger brukt som target — beholdes for bakoverkompatibilitet. */
  plannedThisWeek?: number;
  /** @deprecated Ikke brukt — flyt regnes nå på rullende siste 7 dager. */
  completedThisWeek?: number;
  sessionsPerWeekTarget?: number;
}): MomentumScore {
  const today = new Date(input.nowDate);
  today.setHours(0, 0, 0, 0);
  const todayExclusive = new Date(today);
  todayExclusive.setDate(today.getDate() + 1);
  const last7Start = new Date(today);
  last7Start.setDate(today.getDate() - 6);
  const prev7Start = new Date(last7Start);
  prev7Start.setDate(last7Start.getDate() - 7);

  const last7Sessions = countWorkoutsBetween(input.completedLogDates, last7Start, todayExclusive);
  const prev7Sessions = countWorkoutsBetween(input.completedLogDates, prev7Start, last7Start);

  // Bruk profilens ukestarget som nevner — det er stabilt på tvers av enheter.
  // Vi unngår å bruke `plannedThisWeek` (fra periodeplan) fordi den kan variere
  // mellom enheter avhengig av hydration-rekkefølge fra Supabase, og gir derfor
  // forskjellig flyt-prosent på samme medlem.
  const target = Math.max(1, Number(input.sessionsPerWeekTarget) || 3);

  const pct = Math.min(100, Math.round((last7Sessions / target) * 100));

  const trend: ScoreTrend =
    last7Sessions > prev7Sessions ? "up" : last7Sessions < prev7Sessions ? "down" : "flat";

  let subline = "Bygg flyt med én økt til.";
  if (trend === "up" && last7Sessions > 0) {
    subline = "Du trener mer konsekvent enn forrige uke 🔥";
  } else if (trend === "down" && prev7Sessions > 0) {
    subline = "Roligere uke enn før — én økt holder flyten.";
  } else if (last7Sessions >= target) {
    subline = "Sterk uke — du holder målet.";
  } else if (last7Sessions > 0) {
    subline = "Du er i gang — fortsett jevnt.";
  }

  return { pct, trend, subline, sparkPoints: buildMomentumSparkPoints(input.completedLogDates, input.nowDate) };
}

export function computeConsistencyScore(
  streakWeeks: number,
  recentStreakWeeks: Array<{ trained: boolean }>,
): ConsistencyScore {
  const trainedCount = recentStreakWeeks.filter((week) => week.trained).length;
  const weekPct = (trainedCount / Math.max(1, recentStreakWeeks.length)) * 100;
  const streakPct = (Math.min(streakWeeks, 8) / 8) * 100;
  const pct = Math.min(100, Math.round(weekPct * 0.55 + streakPct * 0.45));

  let subline = "Fullfør minst én økt per uke for å bygge vanen.";
  if (streakWeeks >= 4) {
    subline = `${streakWeeks} uker på rad — sterk treningsvane`;
  } else if (trainedCount >= 6) {
    subline = "Jevn rytme de siste ukene";
  } else if (trainedCount >= 4) {
    subline = "Du bygger jevnhet — fortsett";
  }

  return { pct, subline };
}

export function computeWeeklyScore(
  completedLogDates: Date[],
  nowDate: Date,
  sessionsPerWeekTarget?: number,
): WeeklyScore {
  const weekStart = getWeekStart(nowDate);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const score = countWorkoutsBetween(completedLogDates, weekStart, weekEnd);
  const maxScore = Math.max(2, Number(sessionsPerWeekTarget) || 3);
  const pct = Math.min(100, Math.round((score / maxScore) * 100));
  const remaining = Math.max(0, maxScore - score);

  let subline = `${remaining} økter unna ukesmålet`;
  if (remaining === 0) subline = "Ukesmål nådd 🎯";
  else if (remaining === 1) subline = "1 økt unna ukesmålet";

  return { score, maxScore, pct, subline };
}

export function computeRecoveryScore(reflections: WorkoutReflection[]): RecoveryScore {
  const recent = reflections.slice(0, 6);
  if (!recent.length) {
    return { pct: null, subline: "Logg etter økt for recovery-trend" };
  }

  const avgEnergy = recent.reduce((sum, item) => sum + item.energyLevel, 0) / recent.length;
  const avgDifficulty = recent.reduce((sum, item) => sum + item.difficultyLevel, 0) / recent.length;
  const energyScore = ((6 - avgEnergy) / 5) * 100;
  const loadScore = avgDifficulty <= 3 ? 88 : avgDifficulty <= 4 ? 62 : 38;
  const pct = Math.round(energyScore * 0.55 + loadScore * 0.45);

  let subline = "Balansert belastning — lytt til kroppen";
  if (pct >= 78) subline = "Kroppen virker restituert";
  else if (pct < 50) subline = "Vurder lettere økt eller hviledag";

  return { pct, subline };
}

export function computeMemberXpState(
  completedSessions: number,
  streakWeeks: number,
  achievedLevel: number,
): MemberXpState {
  const totalXp = completedSessions * 100 + streakWeeks * 75 + achievedLevel * 250;

  let level = 1;
  for (let index = XP_LEVEL_THRESHOLDS.length - 1; index >= 0; index -= 1) {
    if (totalXp >= XP_LEVEL_THRESHOLDS[index]) {
      level = index + 1;
      break;
    }
  }

  const currentThreshold = XP_LEVEL_THRESHOLDS[level - 1] ?? 0;
  const nextThreshold = XP_LEVEL_THRESHOLDS[level] ?? currentThreshold + 2500;
  const xpInLevel = totalXp - currentThreshold;
  const xpForNextLevel = Math.max(1, nextThreshold - currentThreshold);
  const pctToNext = Math.min(100, Math.round((xpInLevel / xpForNextLevel) * 100));

  return {
    totalXp,
    level,
    levelLabel: getXpLevelLabel(level),
    xpInLevel,
    xpForNextLevel,
    pctToNext,
  };
}

export function computeMemberProgressScores(input: {
  completedLogDates: Date[];
  completedSessions: number;
  nowDate: Date;
  streakWeeks: number;
  achievedLevel: number;
  recentStreakWeeks: Array<{ trained: boolean }>;
  sessionsPerWeekTarget?: number;
  plannedThisWeek?: number;
  completedThisWeek?: number;
  recentReflections?: WorkoutReflection[];
}): MemberProgressScores {
  return {
    momentum: computeMomentumScore({
      completedLogDates: input.completedLogDates,
      nowDate: input.nowDate,
      plannedThisWeek: input.plannedThisWeek,
      completedThisWeek: input.completedThisWeek,
      sessionsPerWeekTarget: input.sessionsPerWeekTarget,
    }),
    consistency: computeConsistencyScore(input.streakWeeks, input.recentStreakWeeks),
    weekly: computeWeeklyScore(input.completedLogDates, input.nowDate, input.sessionsPerWeekTarget),
    recovery: computeRecoveryScore(input.recentReflections ?? []),
    xp: computeMemberXpState(input.completedSessions, input.streakWeeks, input.achievedLevel),
  };
}

/** @internal exported for tests */
export function weekKeyForDate(date: Date): string {
  return getWeekKey(date);
}
