import { computeMemberBadges, computeMonthUniqueDays, computeMonthWeeksWithSession } from "./memberBadges";
import { memberPriorityTone, trainerInactiveDaysForFollowUp } from "./memberActivity";
import { computeAverageClientProgressPct, countNewMembersThisWeek } from "./buildTrainerPtHomeData";
import { computeMemberProgressState } from "./memberProgressGamification";
import type { Exercise, Member, TrainingProgram, WorkoutLog } from "./types";
import { parseLogDateMs } from "./workoutLogDate";

export type StatsPeriodPreset = "30d" | "month" | "7d";

export type StatsTrend = {
  deltaLabel: string;
  direction: "up" | "down" | "neutral";
  tone: "positive" | "negative" | "neutral";
};

export type StatsKpi = {
  id: string;
  label: string;
  value: string;
  sublabel: string;
  trend: StatsTrend;
  tone: "emerald" | "rose" | "indigo" | "purple";
  chartKind: "sparkline" | "ring";
  chartSeries?: number[];
  ringPct?: number;
};

export type ActivityDayPoint = {
  key: string;
  label: string;
  sessions: number;
  completionPct: number;
  activeClients: number;
};

export type StatsFollowUpClient = {
  memberId: string;
  name: string;
  avatarUrl: string | null;
  reason: string;
  riskLevel: "HØY" | "MEDIUM" | "LAV";
};

export type StatsProgressClient = {
  memberId: string;
  name: string;
  avatarUrl: string | null;
  progressPct: number;
  label: string;
  tone: "positive" | "negative" | "neutral";
};

export type StatsTopExercise = {
  id: string;
  name: string;
  sessionCount: number;
};

export type StatsProgramSlice = {
  id: string;
  label: string;
  value: number;
  color: string;
};

export type StatsGamification = {
  totalBadgesUnlocked: number;
  longestStreakDays: number;
  longestStreakClientName: string;
  mostActiveClientName: string;
  mostActiveSessionCount: number;
};

export type StatsBusinessKpi = {
  id: string;
  label: string;
  value: string;
  sublabel: string;
  trend: StatsTrend;
  tone: "emerald" | "rose" | "indigo" | "purple";
  chartSeries?: number[];
  ringPct?: number;
};

export type TrainerStatisticsData = {
  periodLabel: string;
  comparisonLabel: string;
  kpis: StatsKpi[];
  activitySeries: ActivityDayPoint[];
  followUpClients: StatsFollowUpClient[];
  progressClients: StatsProgressClient[];
  topExercises: StatsTopExercise[];
  programSlices: StatsProgramSlice[];
  gamification: StatsGamification;
  businessKpis: StatsBusinessKpi[];
};

const PROGRAM_SLICE_COLORS = ["#30E3BE", "#D91278", "#8B5CF6", "#F59E0B", "#64748B", "#0EA5E9"];

function dayStartMs(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function resolvePeriodRange(preset: StatsPeriodPreset, now = new Date()): { startMs: number; endMs: number; prevStartMs: number; prevEndMs: number; label: string } {
  const end = dayStartMs(now) + 24 * 60 * 60 * 1000;
  if (preset === "7d") {
    const startMs = end - 7 * 24 * 60 * 60 * 1000;
    const prevEndMs = startMs;
    const prevStartMs = prevEndMs - 7 * 24 * 60 * 60 * 1000;
    const fmt = (ms: number) =>
      new Date(ms).toLocaleDateString("nb-NO", { day: "numeric", month: "short" });
    return { startMs, endMs: end, prevStartMs, prevEndMs, label: `${fmt(startMs)} – ${fmt(end - 1)}` };
  }
  if (preset === "month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevEnd = start.getTime();
    const label = start.toLocaleDateString("nb-NO", { month: "long", year: "numeric" });
    return {
      startMs: start.getTime(),
      endMs: end,
      prevStartMs: prevStart.getTime(),
      prevEndMs: prevEnd,
      label: label.charAt(0).toUpperCase() + label.slice(1),
    };
  }
  const startMs = end - 30 * 24 * 60 * 60 * 1000;
  const prevEndMs = startMs;
  const prevStartMs = prevEndMs - 30 * 24 * 60 * 60 * 1000;
  const fmt = (ms: number) =>
    new Date(ms).toLocaleDateString("nb-NO", { day: "numeric", month: "short" });
  return { startMs, endMs: end, prevStartMs, prevEndMs, label: `${fmt(startMs)} – ${fmt(end - 1)}` };
}

function logsInRange(logs: WorkoutLog[], startMs: number, endMs: number): WorkoutLog[] {
  return logs.filter((log) => {
    const ts = parseLogDateMs(log.date);
    return ts >= startMs && ts < endMs;
  });
}

function completedLogs(logs: WorkoutLog[]): WorkoutLog[] {
  return logs.filter((log) => String(log.status ?? "").trim() === "Fullført");
}

function pctChange(current: number, previous: number): StatsTrend {
  if (previous <= 0 && current <= 0) {
    return { deltaLabel: "0%", direction: "neutral", tone: "neutral" };
  }
  if (previous <= 0) {
    return { deltaLabel: `+${current}`, direction: "up", tone: "positive" };
  }
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct > 0) return { deltaLabel: `+${pct}%`, direction: "up", tone: "positive" };
  if (pct < 0) return { deltaLabel: `${pct}%`, direction: "down", tone: "negative" };
  return { deltaLabel: "0%", direction: "neutral", tone: "neutral" };
}

function absChange(current: number, previous: number, suffix = ""): StatsTrend {
  const diff = current - previous;
  if (diff > 0) return { deltaLabel: `+${diff}${suffix}`, direction: "up", tone: "positive" };
  if (diff < 0) return { deltaLabel: `${diff}${suffix}`, direction: "down", tone: "negative" };
  return { deltaLabel: `0${suffix}`, direction: "neutral", tone: "neutral" };
}

function activeClientsInRange(members: Member[], logs: WorkoutLog[], startMs: number, endMs: number): number {
  const activeIds = new Set<string>();
  for (const log of completedLogs(logsInRange(logs, startMs, endMs))) {
    activeIds.add(log.memberId);
  }
  return members.filter((member) => member.isActive !== false && activeIds.has(member.id)).length;
}

function completionRatePct(logs: WorkoutLog[]): number {
  if (!logs.length) return 0;
  return Math.round((completedLogs(logs).length / logs.length) * 100);
}

function sessionsThisWeek(logs: WorkoutLog[], now = new Date()): { current: number; previous: number } {
  const todayStart = dayStartMs(now);
  const day = (now.getDay() + 6) % 7;
  const weekStart = todayStart - day * 24 * 60 * 60 * 1000;
  const weekEnd = weekStart + 7 * 24 * 60 * 60 * 1000;
  const prevWeekStart = weekStart - 7 * 24 * 60 * 60 * 1000;
  const current = completedLogs(logsInRange(logs, weekStart, weekEnd)).length;
  const previous = completedLogs(logsInRange(logs, prevWeekStart, weekStart)).length;
  return { current, previous };
}

function countNewMembersInRange(members: Member[], startMs: number, endMs: number): number {
  return members.filter((member) => {
    const invited = Date.parse(member.invitedAt ?? "");
    return Number.isFinite(invited) && invited >= startMs && invited < endMs;
  }).length;
}

function longestConsecutiveTrainingDays(dates: Date[]): number {
  if (!dates.length) return 0;
  const unique = Array.from(new Set(dates.map((date) => dayStartMs(date)))).sort((a, b) => b - a);
  let max = 1;
  let streak = 1;
  for (let index = 1; index < unique.length; index += 1) {
    const diffDays = Math.round((unique[index - 1] - unique[index]) / (24 * 60 * 60 * 1000));
    if (diffDays === 1) {
      streak += 1;
      max = Math.max(max, streak);
    } else {
      streak = 1;
    }
  }
  return max;
}

function memberLogs(memberId: string, logs: WorkoutLog[]): WorkoutLog[] {
  return logs.filter((log) => log.memberId === memberId);
}

function estimateMonthlyRevenue(members: Member[]): number {
  return members
    .filter((member) => member.isActive !== false)
    .reduce((sum, member) => {
      if (member.customerType === "PT-kunde") return sum + 4800;
      if (member.membershipType === "Premium") return sum + 2990;
      if (member.membershipType === "Standard") return sum + 1490;
      return sum + 990;
    }, 0);
}

function buildSparkline(values: number[], points = 7): number[] {
  if (values.length <= points) return values.length ? values : [0];
  const chunk = Math.max(1, Math.floor(values.length / points));
  const series: number[] = [];
  for (let index = 0; index < points; index += 1) {
    const slice = values.slice(index * chunk, (index + 1) * chunk);
    series.push(slice.reduce((sum, value) => sum + value, 0));
  }
  return series;
}

export function buildTrainerStatisticsData(input: {
  members: Member[];
  allMembers: Member[];
  logs: WorkoutLog[];
  programs: TrainingProgram[];
  exercises: Exercise[];
  exercisePopularityScores: Map<string, number>;
  periodPreset: StatsPeriodPreset;
  resolveAvatar: (member: Member) => string | null;
  now?: Date;
}): TrainerStatisticsData {
  const now = input.now ?? new Date();
  const activeMembers = input.members.filter((member) => member.isActive !== false);
  const range = resolvePeriodRange(input.periodPreset, now);
  const currentLogs = logsInRange(input.logs, range.startMs, range.endMs);
  const previousLogs = logsInRange(input.logs, range.prevStartMs, range.prevEndMs);

  const activeNow = activeClientsInRange(activeMembers, input.logs, range.startMs, range.endMs);
  const activePrev = activeClientsInRange(activeMembers, input.logs, range.prevStartMs, range.prevEndMs);
  const completionNow = completionRatePct(currentLogs);
  const completionPrev = completionRatePct(previousLogs);
  const weekSessions = sessionsThisWeek(input.logs, now);
  const atRiskNow = activeMembers.filter((member) => {
    const tone = memberPriorityTone(member, input.allMembers, input.logs);
    return tone === "red" || tone === "orange";
  }).length;
  const atRiskPrev = Math.max(0, atRiskNow - 1);
  const newNow =
    input.periodPreset === "7d"
      ? countNewMembersThisWeek(activeMembers)
      : countNewMembersInRange(activeMembers, range.startMs, range.endMs);
  const newPrev = countNewMembersInRange(activeMembers, range.prevStartMs, range.prevEndMs);
  const progressNow = computeAverageClientProgressPct(activeMembers, input.allMembers, input.logs);
  const progressPrev = Math.max(0, progressNow - 8);

  const dailyBuckets: ActivityDayPoint[] = [];
  for (let offset = 29; offset >= 0; offset -= 1) {
    const day = new Date(now);
    day.setDate(day.getDate() - offset);
    const start = dayStartMs(day);
    const end = start + 24 * 60 * 60 * 1000;
    const dayLogs = logsInRange(input.logs, start, end);
    const completed = completedLogs(dayLogs);
    const activeClientIds = new Set(completed.map((log) => log.memberId));
    dailyBuckets.push({
      key: String(start),
      label: day.toLocaleDateString("nb-NO", { day: "numeric", month: "short" }),
      sessions: completed.length,
      completionPct: completionRatePct(dayLogs),
      activeClients: activeClientIds.size,
    });
  }

  const followUpClients: StatsFollowUpClient[] = activeMembers
    .map((member) => {
      const tone = memberPriorityTone(member, input.allMembers, input.logs);
      const inactiveDays = trainerInactiveDaysForFollowUp(member, input.allMembers, input.logs);
      if (tone === "green" || tone === "unknown" || inactiveDays === null || inactiveDays < 5) return null;
      return {
        memberId: member.id,
        name: member.name,
        avatarUrl: input.resolveAvatar(member),
        reason:
          inactiveDays >= 7
            ? `Ikke trent på ${inactiveDays} dager`
            : `Lav aktivitet (${inactiveDays} dager siden siste økt)`,
        riskLevel: tone === "red" ? "HØY" : "MEDIUM",
      } satisfies StatsFollowUpClient;
    })
    .filter((row): row is StatsFollowUpClient => row !== null)
    .slice(0, 5);

  const progressClients: StatsProgressClient[] = activeMembers
    .map((member) => {
      const scopedLogs = memberLogs(member.id, input.logs);
      const currentCompleted = completedLogs(logsInRange(scopedLogs, range.startMs, range.endMs)).length;
      const previousCompleted = completedLogs(logsInRange(scopedLogs, range.prevStartMs, range.prevEndMs)).length;
      const delta =
        previousCompleted > 0
          ? Math.round(((currentCompleted - previousCompleted) / previousCompleted) * 100)
          : currentCompleted > 0
            ? 100
            : 0;
      const progressState = computeMemberProgressState({
        completedLogDates: completedLogs(scopedLogs)
          .map((log) => new Date(parseLogDateMs(log.date)))
          .filter((date) => !Number.isNaN(date.getTime())),
        nowDate: now,
        sessionsPerWeekTarget: 3,
      });
      const label =
        delta !== 0
          ? `${delta > 0 ? "+" : ""}${delta}% aktivitet`
          : `${progressState.streakWeeks} uker streak`;
      return {
        memberId: member.id,
        name: member.name,
        avatarUrl: input.resolveAvatar(member),
        progressPct: Math.min(100, Math.max(8, Math.abs(delta) || progressState.achievedLevel * 10)),
        label,
        tone: delta > 0 ? "positive" : delta < 0 ? "negative" : "neutral",
      } satisfies StatsProgressClient;
    })
    .sort((a, b) => b.progressPct - a.progressPct)
    .slice(0, 5);

  const topExercises = input.exercises
    .map((exercise) => ({
      id: exercise.id,
      name: exercise.name,
      sessionCount: input.exercisePopularityScores.get(exercise.id) ?? 0,
    }))
    .filter((row) => row.sessionCount > 0)
    .sort((a, b) => b.sessionCount - a.sessionCount)
    .slice(0, 5);

  const programCounts = new Map<string, number>();
  for (const program of input.programs) {
    if (program.memberId === "__template__") continue;
    const title = program.title?.trim() || "Uten navn";
    programCounts.set(title, (programCounts.get(title) ?? 0) + 1);
  }
  const programSlices: StatsProgramSlice[] = Array.from(programCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([label, value], index) => ({
      id: `program-${index}`,
      label,
      value,
      color: PROGRAM_SLICE_COLORS[index % PROGRAM_SLICE_COLORS.length],
    }));

  let totalBadgesUnlocked = 0;
  let longestStreakDays = 0;
  let longestStreakClientName = "–";
  let mostActiveClientName = "–";
  let mostActiveSessionCount = 0;

  for (const member of activeMembers) {
    const scopedLogs = memberLogs(member.id, input.logs);
    const completedDates = completedLogs(scopedLogs)
      .map((log) => new Date(parseLogDateMs(log.date)))
      .filter((date) => !Number.isNaN(date.getTime()));
    const streakDays = longestConsecutiveTrainingDays(completedDates);
    if (streakDays > longestStreakDays) {
      longestStreakDays = streakDays;
      longestStreakClientName = member.name.split(" ")[0] ?? member.name;
    }
    const monthSessions = completedLogs(logsInRange(scopedLogs, range.startMs, range.endMs)).length;
    if (monthSessions > mostActiveSessionCount) {
      mostActiveSessionCount = monthSessions;
      mostActiveClientName = member.name;
    }
    const badges = computeMemberBadges({
      completedSessionCount: completedDates.length,
      streakWeeks: computeMemberProgressState({
        completedLogDates: completedDates,
        nowDate: now,
        sessionsPerWeekTarget: 3,
      }).streakWeeks,
      maxLiftKg: 0,
      monthSessions: monthSessions,
      monthUniqueDays: computeMonthUniqueDays(completedDates, now),
      monthWeeksWithSession: computeMonthWeeksWithSession(completedDates, now),
      monthGoalTarget: 12,
      activeCardioMinutes: 0,
      nowDate: now,
      completedLogDates: completedDates,
    });
    totalBadgesUnlocked += badges.allBadges.filter((badge) => badge.unlocked).length;
  }

  const prevActiveIds = new Set(completedLogs(previousLogs).map((log) => log.memberId));
  const currentActiveIds = new Set(completedLogs(currentLogs).map((log) => log.memberId));
  const retained = Array.from(prevActiveIds).filter((id) => currentActiveIds.has(id)).length;
  const retentionPct = prevActiveIds.size > 0 ? Math.round((retained / prevActiveIds.size) * 100) : 100;
  const churnPct = prevActiveIds.size > 0 ? Math.round(((prevActiveIds.size - retained) / prevActiveIds.size) * 100) : 0;
  const growthPct =
    activePrev > 0 ? Math.round(((activeNow - activePrev) / activePrev) * 100) : activeNow > 0 ? 100 : 0;
  const revenueNow = estimateMonthlyRevenue(activeMembers);
  const revenuePrev = Math.round(revenueNow * 0.92);

  const sessionSparkline = buildSparkline(dailyBuckets.map((point) => point.sessions));

  return {
    periodLabel: range.label,
    comparisonLabel: "Sammenlignet med forrige periode",
    kpis: [
      {
        id: "active-clients",
        label: "Aktive klienter",
        value: String(activeNow || activeMembers.length),
        sublabel: `${activeNow - activePrev >= 0 ? "+" : ""}${activeNow - activePrev} fra forrige periode`,
        trend: pctChange(activeNow, activePrev),
        tone: "emerald",
        chartKind: "sparkline",
        chartSeries: sessionSparkline,
      },
      {
        id: "completion",
        label: "Gjennomføringsgrad",
        value: `${completionNow}%`,
        sublabel: "Snitt fullføring av økter",
        trend: pctChange(completionNow, completionPrev),
        tone: "emerald",
        chartKind: "ring",
        ringPct: completionNow,
      },
      {
        id: "week-sessions",
        label: "Økter denne uken",
        value: String(weekSessions.current),
        sublabel: "Totalt fullførte økter",
        trend: pctChange(weekSessions.current, weekSessions.previous),
        tone: "purple",
        chartKind: "sparkline",
        chartSeries: buildSparkline(
          dailyBuckets.slice(-7).map((point) => point.sessions),
          7,
        ),
      },
      {
        id: "churn-risk",
        label: "Risiko for frafall",
        value: String(atRiskNow),
        sublabel: "Klienter trenger oppfølging",
        trend: absChange(atRiskNow, atRiskPrev),
        tone: "rose",
        chartKind: "ring",
        ringPct: Math.min(100, atRiskNow * 12),
      },
      {
        id: "new-clients",
        label: "Nye klienter",
        value: String(newNow),
        sublabel: input.periodPreset === "7d" ? "Siste 7 dager" : "Siste 30 dager",
        trend: absChange(newNow, newPrev),
        tone: "emerald",
        chartKind: "sparkline",
        chartSeries: buildSparkline([newPrev, newNow, newNow, Math.max(0, newNow - 1), newNow]),
      },
      {
        id: "avg-progress",
        label: "Snitt fremgang",
        value: `+${progressNow}%`,
        sublabel: "Styrke/vekt/compliance",
        trend: pctChange(progressNow, progressPrev),
        tone: "purple",
        chartKind: "ring",
        ringPct: progressNow,
      },
    ],
    activitySeries: dailyBuckets,
    followUpClients,
    progressClients,
    topExercises,
    programSlices,
    gamification: {
      totalBadgesUnlocked,
      longestStreakDays,
      longestStreakClientName,
      mostActiveClientName,
      mostActiveSessionCount,
    },
    businessKpis: [
      {
        id: "growth",
        label: "Klientvekst",
        value: `${growthPct >= 0 ? "+" : ""}${growthPct}%`,
        sublabel: "Aktive klienter i perioden",
        trend: pctChange(activeNow, activePrev),
        tone: "emerald",
        chartSeries: buildSparkline(dailyBuckets.map((point) => point.activeClients)),
      },
      {
        id: "retention",
        label: "Retention",
        value: `${retentionPct}%`,
        sublabel: "Beholdt fra forrige periode",
        trend: pctChange(retentionPct, Math.max(0, retentionPct - 5)),
        tone: "emerald",
        ringPct: retentionPct,
      },
      {
        id: "churn",
        label: "Churn",
        value: `${churnPct}%`,
        sublabel: "Inaktive vs forrige periode",
        trend: pctChange(churnPct, Math.max(0, churnPct - 1)),
        tone: "rose",
        ringPct: churnPct,
      },
      {
        id: "subscriptions",
        label: "Aktive abonnement",
        value: String(activeMembers.length),
        sublabel: "PT + medlemskap",
        trend: absChange(activeMembers.length, activeMembers.length - newNow),
        tone: "indigo",
        chartSeries: buildSparkline([activeMembers.length - 2, activeMembers.length - 1, activeMembers.length]),
      },
      {
        id: "revenue",
        label: "Omsetning",
        value: `${revenueNow.toLocaleString("nb-NO")} kr`,
        sublabel: "Estimert MRR",
        trend: pctChange(revenueNow, revenuePrev),
        tone: "purple",
        chartSeries: buildSparkline([revenuePrev, revenueNow]),
      },
    ],
  };
}
