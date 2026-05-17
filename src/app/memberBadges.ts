import { getWeekKey } from "./memberProgressGamification";

export type BadgeIconId =
  | "first-session"
  | "week-streak"
  | "sessions"
  | "lift"
  | "lift-heavy"
  | "month-goal"
  | "monthly";

export type BadgeLevelId = "bronze" | "silver" | "gold" | "diamond" | "legendary";

export type MemberBadgeCategoryId = "training" | "strength" | "consistency" | "activity" | "challenge";

export type MemberBadge = {
  id: string;
  category: MemberBadgeCategoryId;
  categoryTitle: string;
  title: string;
  description: string;
  icon: BadgeIconId;
  level: BadgeLevelId;
  levelLabel: string;
  unlocked: boolean;
  current: number;
  target: number;
};

export type MemberBadgeInput = {
  completedSessionCount: number;
  streakWeeks: number;
  maxLiftKg: number;
  monthSessions: number;
  monthUniqueDays: number;
  monthWeeksWithSession: number;
  monthGoalTarget: number;
  nowDate: Date;
};

export type MemberBadgeCategory = {
  id: MemberBadgeCategoryId;
  title: string;
  badges: MemberBadge[];
  unlockedCount: number;
};

export type MemberBadgeCollection = {
  categories: MemberBadgeCategory[];
  allBadges: MemberBadge[];
  totalCount: number;
  totalUnlocked: number;
};

type BadgeMetric = "completedSessionCount" | "streakWeeks" | "maxLiftKg" | "monthSessions" | "monthUniqueDays" | "monthGoalPercent";

type BadgeTrack = {
  id: string;
  category: MemberBadgeCategoryId;
  categoryTitle: string;
  title: string;
  description: string;
  icon: BadgeIconId;
  metric: BadgeMetric;
  levels: Array<{ level: BadgeLevelId; target: number }>;
};

const BADGE_LEVEL_LABELS: Record<BadgeLevelId, string> = {
  bronze: "Nivå 1",
  silver: "Nivå 2",
  gold: "Nivå 3",
  diamond: "Nivå 4",
  legendary: "Legendarisk",
};

const BADGE_TRACKS: BadgeTrack[] = [
  {
    id: "sessions",
    category: "training",
    categoryTitle: "Trening",
    title: "Øktjeger",
    description: "Fullfør registrerte økter",
    icon: "sessions",
    metric: "completedSessionCount",
    levels: [
      { level: "bronze", target: 1 },
      { level: "silver", target: 10 },
      { level: "gold", target: 25 },
      { level: "diamond", target: 50 },
      { level: "legendary", target: 100 },
    ],
  },
  {
    id: "streak",
    category: "consistency",
    categoryTitle: "Streaks",
    title: "Streak",
    description: "Tren minst én gang per uke over tid",
    icon: "week-streak",
    metric: "streakWeeks",
    levels: [
      { level: "bronze", target: 2 },
      { level: "silver", target: 4 },
      { level: "gold", target: 8 },
      { level: "diamond", target: 12 },
      { level: "legendary", target: 20 },
    ],
  },
  {
    id: "lift",
    category: "strength",
    categoryTitle: "Styrke",
    title: "Tungvekter",
    description: "Tyngste registrerte sett",
    icon: "lift-heavy",
    metric: "maxLiftKg",
    levels: [
      { level: "bronze", target: 40 },
      { level: "silver", target: 60 },
      { level: "gold", target: 90 },
      { level: "diamond", target: 120 },
      { level: "legendary", target: 150 },
    ],
  },
  {
    id: "month-sessions",
    category: "activity",
    categoryTitle: "Aktivitet",
    title: "Månedsdriv",
    description: "Fullfør økter i inneværende måned",
    icon: "month-goal",
    metric: "monthSessions",
    levels: [
      { level: "bronze", target: 4 },
      { level: "silver", target: 6 },
      { level: "gold", target: 8 },
      { level: "diamond", target: 12 },
      { level: "legendary", target: 16 },
    ],
  },
  {
    id: "training-days",
    category: "activity",
    categoryTitle: "Aktivitet",
    title: "Treningsdager",
    description: "Tren på ulike dager i måneden",
    icon: "monthly",
    metric: "monthUniqueDays",
    levels: [
      { level: "bronze", target: 3 },
      { level: "silver", target: 5 },
      { level: "gold", target: 7 },
      { level: "diamond", target: 10 },
      { level: "legendary", target: 14 },
    ],
  },
  {
    id: "goal-percent",
    category: "challenge",
    categoryTitle: "Utfordringer",
    title: "Målknuser",
    description: "Nå øktmålet du har satt",
    icon: "first-session",
    metric: "monthGoalPercent",
    levels: [
      { level: "bronze", target: 25 },
      { level: "silver", target: 50 },
      { level: "gold", target: 75 },
      { level: "diamond", target: 100 },
      { level: "legendary", target: 125 },
    ],
  },
];

function readMetric(metric: BadgeMetric, input: MemberBadgeInput): number {
  switch (metric) {
    case "completedSessionCount":
      return input.completedSessionCount;
    case "streakWeeks":
      return input.streakWeeks;
    case "maxLiftKg":
      return input.maxLiftKg;
    case "monthSessions":
      return input.monthSessions;
    case "monthUniqueDays":
      return input.monthUniqueDays;
    case "monthGoalPercent": {
      const target = Math.max(1, input.monthGoalTarget || 10);
      return Math.round((input.monthSessions / target) * 100);
    }
    default:
      return 0;
  }
}

function buildTrackBadges(track: BadgeTrack, input: MemberBadgeInput): MemberBadge[] {
  const current = readMetric(track.metric, input);
  return track.levels.map(({ level, target }) => ({
    id: `${track.id}-${level}`,
    category: track.category,
    categoryTitle: track.categoryTitle,
    title: track.title,
    description: track.description,
    icon: track.icon,
    level,
    levelLabel: BADGE_LEVEL_LABELS[level],
    current: Math.min(current, target),
    target,
    unlocked: current >= target,
  }));
}

export function computeMaxLiftKgFromLogs(
  logs: Array<{ status: string; results?: Array<{ completed?: boolean; performedWeight?: number | string }> }>,
): number {
  let max = 0;
  logs.forEach((log) => {
    if (log.status !== "Fullført") return;
    (log.results ?? []).forEach((result) => {
      if (!result.completed) return;
      const weight = Number(result.performedWeight) || 0;
      if (weight > max) max = weight;
    });
  });
  return max;
}

export function computeMonthUniqueDays(completedLogDates: Date[], nowDate: Date): number {
  const month = nowDate.getMonth();
  const year = nowDate.getFullYear();
  const days = new Set<string>();
  completedLogDates.forEach((date) => {
    if (date.getMonth() !== month || date.getFullYear() !== year) return;
    days.add(date.toDateString());
  });
  return days.size;
}

export function computeMonthWeeksWithSession(completedLogDates: Date[], nowDate: Date): number {
  const month = nowDate.getMonth();
  const year = nowDate.getFullYear();
  const weeks = new Set<string>();
  completedLogDates.forEach((date) => {
    if (date.getMonth() !== month || date.getFullYear() !== year) return;
    weeks.add(getWeekKey(date));
  });
  return weeks.size;
}

export function computeMemberBadges(input: MemberBadgeInput): MemberBadgeCollection {
  const allBadges = BADGE_TRACKS.flatMap((track) => buildTrackBadges(track, input));
  const categories = BADGE_TRACKS.reduce<MemberBadgeCategory[]>((acc, track) => {
    if (acc.some((category) => category.id === track.category)) return acc;
    const badges = allBadges.filter((badge) => badge.category === track.category);
    acc.push({
      id: track.category,
      title: track.categoryTitle,
      badges,
      unlockedCount: badges.filter((badge) => badge.unlocked).length,
    });
    return acc;
  }, []);

  return {
    categories,
    allBadges,
    totalCount: allBadges.length,
    totalUnlocked: allBadges.filter((badge) => badge.unlocked).length,
  };
}

export function flattenMemberBadges(collection: MemberBadgeCollection): MemberBadge[] {
  return collection.allBadges;
}
