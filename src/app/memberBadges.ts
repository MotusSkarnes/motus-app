export type MemberBadge = {
  id: string;
  title: string;
  description: string;
  emoji: string;
  unlocked: boolean;
  current: number;
  target: number;
};

export type MemberBadgeInput = {
  completedSessionCount: number;
  streakWeeks: number;
  maxLiftKg: number;
  monthGoalCurrent: number;
  monthGoalTarget: number;
};

type BadgeDefinition = {
  id: string;
  title: string;
  description: string;
  emoji: string;
  target: number;
  current: (input: MemberBadgeInput) => number;
};

const BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    id: "first-session",
    title: "Første økt",
    description: "Fullfør din første registrerte økt",
    emoji: "🚀",
    target: 1,
    current: (input) => input.completedSessionCount,
  },
  {
    id: "week-streak-4",
    title: "4 uker i rytme",
    description: "Minst én økt per uke, 4 uker på rad",
    emoji: "🔥",
    target: 4,
    current: (input) => input.streakWeeks,
  },
  {
    id: "sessions-10",
    title: "10 økter",
    description: "Logg 10 fullførte økter totalt",
    emoji: "💪",
    target: 10,
    current: (input) => input.completedSessionCount,
  },
  {
    id: "lift-50",
    title: "50 kg-løft",
    description: "Løft 50 kg eller mer i ett sett",
    emoji: "🏋️",
    target: 50,
    current: (input) => input.maxLiftKg,
  },
  {
    id: "lift-100",
    title: "100 kg-løft",
    description: "Løft 100 kg eller mer i ett sett",
    emoji: "⚡",
    target: 100,
    current: (input) => input.maxLiftKg,
  },
  {
    id: "week-streak-8",
    title: "8 uker i rytme",
    description: "Hold ukerytmen i 8 uker",
    emoji: "🌟",
    target: 8,
    current: (input) => input.streakWeeks,
  },
  {
    id: "lift-150",
    title: "150 kg-løft",
    description: "Løft 150 kg eller mer i ett sett",
    emoji: "🦾",
    target: 150,
    current: (input) => input.maxLiftKg,
  },
  {
    id: "month-goal",
    title: "Månedsmål",
    description: "Nå målet ditt for økter denne måneden",
    emoji: "📅",
    target: 0,
    current: (input) => input.monthGoalCurrent,
  },
];

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

export function computeMemberBadges(input: MemberBadgeInput): MemberBadge[] {
  const monthTarget = Math.max(1, input.monthGoalTarget);
  return BADGE_DEFINITIONS.map((definition) => {
    const target = definition.id === "month-goal" ? monthTarget : definition.target;
    const current = definition.id === "month-goal" ? input.monthGoalCurrent : definition.current(input);
    const cappedCurrent = Math.min(current, target);
    return {
      id: definition.id,
      title: definition.title,
      description: definition.description,
      emoji: definition.emoji,
      current: cappedCurrent,
      target,
      unlocked: current >= target,
    };
  });
}
