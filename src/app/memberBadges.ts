import { getWeekKey } from "./memberProgressGamification";

export type BadgeIconId =
  | "first-session"
  | "week-streak"
  | "sessions"
  | "lift"
  | "lift-heavy"
  | "month-goal"
  | "monthly";

export type MemberBadgeKind = "permanent" | "monthly";

export type MemberBadge = {
  id: string;
  kind: MemberBadgeKind;
  title: string;
  description: string;
  icon: BadgeIconId;
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

export type MemberBadgeCollection = {
  permanent: MemberBadge[];
  monthly: MemberBadge[];
  monthLabel: string;
  allPermanentUnlocked: boolean;
  allMonthlyUnlocked: boolean;
};

type PermanentBadgeDefinition = {
  id: string;
  title: string;
  description: string;
  icon: BadgeIconId;
  target: number;
  current: (input: MemberBadgeInput) => number;
};

type MonthlyMetric = "monthSessions" | "monthUniqueDays" | "monthWeeksWithSession" | "streakWeeks" | "monthGoalFromProfile";

type MonthlyBadgeTemplate = {
  id: string;
  title: string;
  description: string;
  icon: BadgeIconId;
  metric: MonthlyMetric;
  target: number | ((input: MemberBadgeInput) => number);
};

const PERMANENT_BADGE_DEFINITIONS: PermanentBadgeDefinition[] = [
  {
    id: "first-session",
    title: "Første økt",
    description: "Fullfør din første registrerte økt",
    icon: "first-session",
    target: 1,
    current: (input) => input.completedSessionCount,
  },
  {
    id: "week-streak-4",
    title: "4-ukers streak",
    description: "Minst én økt per uke, 4 uker i streak",
    icon: "week-streak",
    target: 4,
    current: (input) => input.streakWeeks,
  },
  {
    id: "sessions-10",
    title: "10 økter",
    description: "Logg 10 fullførte økter totalt",
    icon: "sessions",
    target: 10,
    current: (input) => input.completedSessionCount,
  },
  {
    id: "lift-50",
    title: "50 kg-løft",
    description: "Løft 50 kg eller mer i ett sett",
    icon: "lift",
    target: 50,
    current: (input) => input.maxLiftKg,
  },
  {
    id: "lift-100",
    title: "100 kg-løft",
    description: "Løft 100 kg eller mer i ett sett",
    icon: "lift-heavy",
    target: 100,
    current: (input) => input.maxLiftKg,
  },
  {
    id: "week-streak-8",
    title: "8-ukers streak",
    description: "Hold streaken i 8 uker",
    icon: "week-streak",
    target: 8,
    current: (input) => input.streakWeeks,
  },
  {
    id: "lift-150",
    title: "150 kg-løft",
    description: "Løft 150 kg eller mer i ett sett",
    icon: "lift-heavy",
    target: 150,
    current: (input) => input.maxLiftKg,
  },
];

/** Roterer — 3 utvalgte per kalendermåned. */
const MONTHLY_BADGE_POOL: MonthlyBadgeTemplate[] = [
  {
    id: "m-sessions-4",
    title: "4 økter denne måneden",
    description: "Fullfør 4 økter før måneden er omme",
    icon: "month-goal",
    metric: "monthSessions",
    target: 4,
  },
  {
    id: "m-sessions-6",
    title: "6 økter denne måneden",
    description: "Bygg jevn aktivitet gjennom måneden",
    icon: "month-goal",
    metric: "monthSessions",
    target: 6,
  },
  {
    id: "m-sessions-8",
    title: "8 økter denne måneden",
    description: "Hold et høyt treningsvolum denne måneden",
    icon: "month-goal",
    metric: "monthSessions",
    target: 8,
  },
  {
    id: "m-days-4",
    title: "4 treningsdager",
    description: "Tren på minst 4 ulike dager denne måneden",
    icon: "sessions",
    metric: "monthUniqueDays",
    target: 4,
  },
  {
    id: "m-days-6",
    title: "6 treningsdager",
    description: "Spred treningen på flere dager i måneden",
    icon: "sessions",
    metric: "monthUniqueDays",
    target: 6,
  },
  {
    id: "m-weeks-2",
    title: "2 aktive uker",
    description: "Tren minst én gang i 2 uker denne måneden",
    icon: "week-streak",
    metric: "monthWeeksWithSession",
    target: 2,
  },
  {
    id: "m-weeks-3",
    title: "3 aktive uker",
    description: "Tren minst én gang i 3 uker denne måneden",
    icon: "week-streak",
    metric: "monthWeeksWithSession",
    target: 3,
  },
  {
    id: "m-streak-2",
    title: "2-ukers streak",
    description: "Hold streaken på minst 2 uker",
    icon: "week-streak",
    metric: "streakWeeks",
    target: 2,
  },
  {
    id: "m-profile-goal",
    title: "Ditt månedsmål",
    description: "Nå målet du har satt for økter per måned",
    icon: "monthly",
    metric: "monthGoalFromProfile",
    target: (input) => Math.max(4, Math.min(24, input.monthGoalTarget || 10)),
  },
];

const MONTHLY_BADGES_PER_MONTH = 3;

function monthSeed(year: number, monthIndex: number): number {
  return year * 12 + monthIndex;
}

function seededShuffle<T>(items: T[], seed: number): T[] {
  const copy = [...items];
  let state = seed || 1;
  const rand = () => {
    state = (state * 1664525 + 1013904223) % 0x100000000;
    return state / 0x100000000;
  };
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function pickMonthlyBadgeIds(year: number, monthIndex: number, count = MONTHLY_BADGES_PER_MONTH): string[] {
  const shuffled = seededShuffle(MONTHLY_BADGE_POOL, monthSeed(year, monthIndex));
  return shuffled.slice(0, count).map((item) => item.id);
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

function readMonthlyMetric(metric: MonthlyMetric, input: MemberBadgeInput): number {
  switch (metric) {
    case "monthSessions":
      return input.monthSessions;
    case "monthUniqueDays":
      return input.monthUniqueDays;
    case "monthWeeksWithSession":
      return input.monthWeeksWithSession;
    case "streakWeeks":
      return input.streakWeeks;
    case "monthGoalFromProfile":
      return input.monthSessions;
    default:
      return 0;
  }
}

function buildBadge(
  definition: {
    id: string;
    title: string;
    description: string;
    icon: BadgeIconId;
    target: number;
    current: number;
  },
  kind: MemberBadgeKind,
): MemberBadge {
  const cappedCurrent = Math.min(definition.current, definition.target);
  return {
    id: definition.id,
    kind,
    title: definition.title,
    description: definition.description,
    icon: definition.icon,
    current: cappedCurrent,
    target: definition.target,
    unlocked: definition.current >= definition.target,
  };
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

export function computeMemberBadges(input: MemberBadgeInput): MemberBadgeCollection {
  const permanent = PERMANENT_BADGE_DEFINITIONS.map((definition) =>
    buildBadge(
      {
        id: definition.id,
        title: definition.title,
        description: definition.description,
        icon: definition.icon,
        target: definition.target,
        current: definition.current(input),
      },
      "permanent",
    ),
  ).sort((a, b) => Number(b.unlocked) - Number(a.unlocked));

  const year = input.nowDate.getFullYear();
  const monthIndex = input.nowDate.getMonth();
  const monthLabel = input.nowDate.toLocaleDateString("nb-NO", { month: "long", year: "numeric" });
  const selectedIds = new Set(pickMonthlyBadgeIds(year, monthIndex));
  const monthlyTemplates = MONTHLY_BADGE_POOL.filter((item) => selectedIds.has(item.id));

  const monthly = monthlyTemplates
    .map((template) => {
      const target = typeof template.target === "function" ? template.target(input) : template.target;
      const current = readMonthlyMetric(template.metric, input);
      return buildBadge(
        {
          id: `${template.id}-${year}-${monthIndex}`,
          title: template.title,
          description: template.description,
          icon: template.icon,
          target,
          current,
        },
        "monthly",
      );
    })
    .sort((a, b) => Number(b.unlocked) - Number(a.unlocked));

  return {
    permanent,
    monthly,
    monthLabel,
    allPermanentUnlocked: permanent.every((badge) => badge.unlocked),
    allMonthlyUnlocked: monthly.length > 0 && monthly.every((badge) => badge.unlocked),
  };
}

/** Flat liste for enkel visning (permanente først, deretter månedens). */
export function flattenMemberBadges(collection: MemberBadgeCollection): MemberBadge[] {
  return [...collection.permanent, ...collection.monthly];
}
