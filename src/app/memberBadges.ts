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

export type MemberBadgeCategoryId = "training" | "strength" | "consistency" | "activity" | "challenge" | "secret";

export type MemberBadgeLevel = {
  level: BadgeLevelId;
  levelLabel: string;
  levelName: string;
  target: number;
  unlocked: boolean;
};

export type MemberBadge = {
  id: string;
  category: MemberBadgeCategoryId;
  categoryTitle: string;
  title: string;
  description: string;
  icon: BadgeIconId;
  level: BadgeLevelId;
  levelLabel: string;
  levelName: string;
  unlocked: boolean;
  current: number;
  target: number;
  progressPct: number;
  achievedLevelIndex: number;
  levels: MemberBadgeLevel[];
  hidden?: boolean;
  secret?: boolean;
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
  completedLogDates?: Date[];
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
  totalLevels: number;
  totalUnlockedLevels: number;
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

const BADGE_LEVEL_NAMES: Record<BadgeLevelId, string> = {
  bronze: "Bronse",
  silver: "Sølv",
  gold: "Gull",
  diamond: "Diamant",
  legendary: "Legend",
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

function buildTrackBadge(track: BadgeTrack, input: MemberBadgeInput): MemberBadge {
  const current = readMetric(track.metric, input);
  let achievedLevelIndex = -1;
  track.levels.forEach(({ target }, index) => {
    if (current >= target) achievedLevelIndex = index;
  });

  const unlocked = achievedLevelIndex >= 0;
  const displayLevelIndex = unlocked ? achievedLevelIndex : 0;
  const displayLevel = track.levels[displayLevelIndex];
  const completedAllLevels = achievedLevelIndex >= track.levels.length - 1;
  const nextLevelIndex = completedAllLevels ? achievedLevelIndex : achievedLevelIndex + 1;
  const nextLevel = track.levels[Math.max(0, nextLevelIndex)];
  const previousTarget = unlocked ? track.levels[achievedLevelIndex].target : 0;
  const targetSpan = Math.max(1, nextLevel.target - previousTarget);
  const progressPct = completedAllLevels
    ? 100
    : Math.max(0, Math.min(100, Math.round(((current - previousTarget) / targetSpan) * 100)));

  return {
    id: track.id,
    category: track.category,
    categoryTitle: track.categoryTitle,
    title: track.title,
    description: track.description,
    icon: track.icon,
    level: displayLevel.level,
    levelLabel: unlocked ? BADGE_LEVEL_LABELS[displayLevel.level] : "Låst",
    levelName: unlocked ? BADGE_LEVEL_NAMES[displayLevel.level] : "Ikke låst opp",
    current,
    target: nextLevel.target,
    progressPct,
    achievedLevelIndex,
    unlocked,
    levels: track.levels.map(({ level, target }, index) => ({
      level,
      levelLabel: BADGE_LEVEL_LABELS[level],
      levelName: BADGE_LEVEL_NAMES[level],
      target,
      unlocked: index <= achievedLevelIndex,
    })),
  };
}

function hasMay17Workout(completedLogDates: Date[] = []): boolean {
  return completedLogDates.some((date) => date.getMonth() === 4 && date.getDate() === 17);
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function daysBetween(from: Date, to: Date): number {
  const fromDay = startOfDay(from);
  const toDay = startOfDay(to);
  const fromUtc = Date.UTC(fromDay.getFullYear(), fromDay.getMonth(), fromDay.getDate());
  const toUtc = Date.UTC(toDay.getFullYear(), toDay.getMonth(), toDay.getDate());
  return Math.floor((toUtc - fromUtc) / 86_400_000);
}

function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function hasNoTrainingGapOver14DaysForSixMonths(completedLogDates: Date[] = [], nowDate: Date): boolean {
  const now = startOfDay(nowDate);
  const sixMonthsAgo = new Date(now);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const uniqueDates = Array.from(
    new Set(
      completedLogDates
        .map(startOfDay)
        .filter((date) => date >= sixMonthsAgo && date <= now)
        .map(localDateKey),
    ),
  )
    .map((value) => new Date(`${value}T00:00:00`))
    .sort((a, b) => a.getTime() - b.getTime());

  if (!uniqueDates.length) return false;
  if (daysBetween(sixMonthsAgo, uniqueDates[0]) > 14) return false;
  if (daysBetween(uniqueDates[uniqueDates.length - 1], now) > 14) return false;

  for (let i = 1; i < uniqueDates.length; i += 1) {
    if (daysBetween(uniqueDates[i - 1], uniqueDates[i]) > 14) return false;
  }

  return true;
}

function hasReturnedAfterLongPause(completedLogDates: Date[] = []): boolean {
  const uniqueDates = Array.from(new Set(completedLogDates.map(startOfDay).map(localDateKey)))
    .map((value) => new Date(`${value}T00:00:00`))
    .sort((a, b) => a.getTime() - b.getTime());

  for (let i = 1; i < uniqueDates.length; i += 1) {
    if (daysBetween(uniqueDates[i - 1], uniqueDates[i]) >= 30) return true;
  }

  return false;
}

function hasBeenTrainingFor100Days(completedLogDates: Date[] = [], nowDate: Date): boolean {
  const firstCompletedDate = completedLogDates
    .map(startOfDay)
    .sort((a, b) => a.getTime() - b.getTime())[0];

  return firstCompletedDate ? daysBetween(firstCompletedDate, nowDate) >= 100 : false;
}

function hasWorkoutBeforeSunrise(completedLogDates: Date[] = []): boolean {
  return completedLogDates.some((date) => date.getHours() < 5 || (date.getHours() === 5 && date.getMinutes() < 30));
}

function hasJulyWorkout(completedLogDates: Date[] = []): boolean {
  return completedLogDates.some((date) => date.getMonth() === 6);
}

function hasJanuaryWorkout(completedLogDates: Date[] = []): boolean {
  return completedLogDates.some((date) => date.getMonth() === 0);
}

function buildSecretBadge(input: { id: string; title: string; description: string; levelName: string }): MemberBadge {
  return {
    id: input.id,
    category: "secret",
    categoryTitle: "Skjulte",
    title: input.title,
    description: input.description,
    icon: "first-session",
    level: "legendary",
    levelLabel: "Skjult",
    levelName: input.levelName,
    current: 1,
    target: 1,
    progressPct: 100,
    achievedLevelIndex: 0,
    unlocked: true,
    hidden: true,
    secret: true,
    levels: [
      {
        level: "legendary",
        levelLabel: "Skjult",
        levelName: input.levelName,
        target: 1,
        unlocked: true,
      },
    ],
  };
}

function buildSecretBadges(input: MemberBadgeInput): MemberBadge[] {
  const hasSixMonthFlow = hasNoTrainingGapOver14DaysForSixMonths(input.completedLogDates, input.nowDate);
  const hasComeback = hasReturnedAfterLongPause(input.completedLogDates);
  const has100DaysSinceFirstWorkout = hasBeenTrainingFor100Days(input.completedLogDates, input.nowDate);
  const hasEarlyWorkout = hasWorkoutBeforeSunrise(input.completedLogDates);
  const hasSummerWorkout = hasJulyWorkout(input.completedLogDates);
  const hasNewYearWorkout = hasJanuaryWorkout(input.completedLogDates);
  const sixMonthBadge = buildSecretBadge({
    id: "never-two-weeks-without",
    title: "Aldri to uker uten",
    description: "Ingen treningspause over 14 dager på 6 måneder.",
    levelName: "6 mnd",
  });
  const comebackBadge = buildSecretBadge({
    id: "back-again",
    title: "Tilbake igjen",
    description: "Kom tilbake etter en lang treningspause.",
    levelName: "Comeback",
  });
  const habitBadge = buildSecretBadge({
    id: "habit-sticks",
    title: "Vanen sitter",
    description: "100 dager siden første registrerte økt.",
    levelName: "100 dager",
  });
  const earlyBadge = buildSecretBadge({
    id: "before-sunrise",
    title: "Før sola",
    description: "Trente før 05:30.",
    levelName: "05:30",
  });
  const summerBadge = buildSecretBadge({
    id: "summer-loyal",
    title: "Sommertrofast",
    description: "Registrerte en treningsøkt i juli.",
    levelName: "Juli",
  });
  const newYearBadge = buildSecretBadge({
    id: "new-start",
    title: "Ny start",
    description: "Registrerte første økt i et nytt år.",
    levelName: "Nytt år",
  });
  const unlockedSecretBadges = [
    hasSixMonthFlow ? sixMonthBadge : null,
    hasComeback ? comebackBadge : null,
    has100DaysSinceFirstWorkout ? habitBadge : null,
    hasEarlyWorkout ? earlyBadge : null,
    hasSummerWorkout ? summerBadge : null,
    hasNewYearWorkout ? newYearBadge : null,
  ].filter((badge): badge is MemberBadge => badge !== null);

  if (!hasMay17Workout(input.completedLogDates)) return unlockedSecretBadges;

  return [
    {
      id: "may-17-workout",
      category: "secret",
      categoryTitle: "Skjulte",
      title: "17. mai-økt",
      description: "Registrerte trening på Norges nasjonaldag.",
      icon: "first-session",
      level: "legendary",
      levelLabel: "Skjult",
      levelName: "17. mai",
      current: 1,
      target: 1,
      progressPct: 100,
      achievedLevelIndex: 0,
      unlocked: true,
      hidden: true,
      secret: true,
      levels: [
        {
          level: "legendary",
          levelLabel: "Skjult",
          levelName: "17. mai",
          target: 1,
          unlocked: true,
        },
      ],
    },
    ...unlockedSecretBadges,
  ];
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
  const allBadges = [...BADGE_TRACKS.map((track) => buildTrackBadge(track, input)), ...buildSecretBadges(input)];
  const categorySeeds = [
    ...BADGE_TRACKS.map((track) => ({ id: track.category, title: track.categoryTitle })),
    ...allBadges.filter((badge) => badge.secret).map((badge) => ({ id: badge.category, title: badge.categoryTitle })),
  ];
  const categories = categorySeeds.reduce<MemberBadgeCategory[]>((acc, seed) => {
    if (acc.some((category) => category.id === seed.id)) return acc;
    const badges = allBadges.filter((badge) => badge.category === seed.id);
    acc.push({
      id: seed.id,
      title: seed.title,
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
    totalLevels: allBadges.reduce((sum, badge) => sum + badge.levels.length, 0),
    totalUnlockedLevels: allBadges.reduce((sum, badge) => sum + badge.levels.filter((level) => level.unlocked).length, 0),
  };
}

export function flattenMemberBadges(collection: MemberBadgeCollection): MemberBadge[] {
  return collection.allBadges;
}

export function formatBadgeMetricValue(badgeId: string, value: number): string {
  switch (badgeId) {
    case "streak":
      return value === 1 ? "1 uke" : `${value} uker`;
    case "lift":
      return `${value} kg`;
    case "goal-percent":
      return `${value}%`;
    case "month-sessions":
    case "sessions":
      return value === 1 ? "1 økt" : `${value} økter`;
    case "training-days":
      return value === 1 ? "1 dag" : `${value} dager`;
    default:
      return String(value);
  }
}

export function getBadgeNextLevel(badge: MemberBadge): MemberBadgeLevel | null {
  const nextIndex = badge.achievedLevelIndex + 1;
  if (nextIndex >= badge.levels.length) return null;
  return badge.levels[nextIndex];
}

export function getBadgeProgressLabel(badge: MemberBadge): string {
  const next = getBadgeNextLevel(badge);
  if (!next) return "Alle nivåer er låst opp";
  return `${formatBadgeMetricValue(badge.id, badge.current)} av ${formatBadgeMetricValue(badge.id, next.target)}`;
}

export function getBadgeUnlockHint(badge: MemberBadge): string {
  const next = getBadgeNextLevel(badge);
  if (!next) return "Du har nådd høyeste nivå på denne badge-en.";

  const target = formatBadgeMetricValue(badge.id, next.target);
  switch (badge.id) {
    case "sessions":
      return `Fullfør ${target} registrerte økter totalt for å nå ${next.levelName}.`;
    case "streak":
      return `Hold streak med minst én økt per uke i ${target} på rad for å nå ${next.levelName}.`;
    case "lift":
      return `Registrer ditt tyngste sett på minst ${target} for å nå ${next.levelName}.`;
    case "month-sessions":
      return `Fullfør ${target} i inneværende måned for å nå ${next.levelName}.`;
    case "training-days":
      return `Tren på ${target} ulike dager denne måneden for å nå ${next.levelName}.`;
    case "goal-percent":
      return `Nå ${target} av månedens øktmål for å nå ${next.levelName}.`;
    default:
      return badge.description;
  }
}
