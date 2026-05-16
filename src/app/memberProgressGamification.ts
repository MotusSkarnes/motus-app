export const ACHIEVEMENT_MAX_LEVEL = 10;

export const PROGRESS_STEP_LABELS = [
  "Kom i gang",
  "Første vaner",
  "Bygger vanen",
  "Stabil uke",
  "Holder flyten",
  "Jevn trener",
  "Sterk vane",
  "Dedikert",
  "Topp kontinuitet",
  "Motus-mester",
] as const;

export type RecentStreakWeek = {
  key: string;
  shortLabel: string;
  trained: boolean;
  inActiveStreak: boolean;
};

export type ProgressGoal = {
  id: string;
  title: string;
  description: string;
  current: number;
  target: number;
  unlocked: boolean;
};

export type MonthHabitGoal = {
  current: number;
  target: number;
  unlocked: boolean;
  encouragement: string;
};

export type MemberProgressState = {
  streakWeeks: number;
  activeStreakWeekKeys: Set<string>;
  achievedLevel: number;
  workingLevel: number;
  hasCompletedAllLevels: boolean;
  stepLabel: string;
  nextStepLabel: string | null;
  goals: ProgressGoal[];
  streakSubline: string;
  recentStreakWeeks: RecentStreakWeek[];
  streakMilestoneTarget: number;
  monthGoal: MonthHabitGoal;
};

export function getWeekKey(date: Date): string {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day + 3);
  const firstThursday = new Date(d.getFullYear(), 0, 4);
  const firstDay = (firstThursday.getDay() + 6) % 7;
  firstThursday.setDate(firstThursday.getDate() - firstDay + 3);
  const week = 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 24 * 60 * 60 * 1000));
  return `${d.getFullYear()}-${String(week).padStart(2, "0")}`;
}

export function getLevelRequirements(level: number) {
  return {
    sessionsTarget: 10 + (level - 1) * 5,
    streakTarget: 3 + (level - 1),
    trainingDaysTarget: 5 + (level - 1) * 2,
    firstSessionTarget: level,
  };
}

export function computeStreakWeeks(trainingWeekKeys: string[]): number {
  if (!trainingWeekKeys.length) return 0;
  let streak = 1;
  let current = trainingWeekKeys[0];
  for (let i = 1; i < trainingWeekKeys.length; i += 1) {
    const [year, week] = current.split("-").map(Number);
    const prevWeekDate = new Date(year, 0, 4 + (week - 2) * 7);
    const expectedPrev = getWeekKey(prevWeekDate);
    if (trainingWeekKeys[i] !== expectedPrev) break;
    streak += 1;
    current = trainingWeekKeys[i];
  }
  return streak;
}

export function computeActiveStreakWeekKeys(trainingWeekKeys: string[]): Set<string> {
  if (!trainingWeekKeys.length) return new Set<string>();
  const keys = new Set<string>([trainingWeekKeys[0]]);
  let current = trainingWeekKeys[0];
  for (let i = 1; i < trainingWeekKeys.length; i += 1) {
    const [year, week] = current.split("-").map(Number);
    const prevWeekDate = new Date(year, 0, 4 + (week - 2) * 7);
    const expectedPrev = getWeekKey(prevWeekDate);
    if (trainingWeekKeys[i] !== expectedPrev) break;
    current = trainingWeekKeys[i];
    keys.add(current);
  }
  return keys;
}

export function computeAchievedLevel(completedSessions: number, streakWeeks: number, uniqueTrainingDays: number): number {
  let highestUnlockedLevel = 0;
  for (let level = 1; level <= ACHIEVEMENT_MAX_LEVEL; level += 1) {
    const { sessionsTarget, streakTarget, trainingDaysTarget, firstSessionTarget } = getLevelRequirements(level);
    const isLevelUnlocked =
      completedSessions >= sessionsTarget &&
      streakWeeks >= streakTarget &&
      uniqueTrainingDays >= trainingDaysTarget &&
      completedSessions >= firstSessionTarget;
    if (!isLevelUnlocked) break;
    highestUnlockedLevel = level;
  }
  return highestUnlockedLevel;
}

export function getProgressStepLabel(level: number): string {
  if (level < 1) return PROGRESS_STEP_LABELS[0];
  if (level > ACHIEVEMENT_MAX_LEVEL) return PROGRESS_STEP_LABELS[ACHIEVEMENT_MAX_LEVEL - 1];
  return PROGRESS_STEP_LABELS[level - 1];
}

export function buildProgressGoals(
  workingLevel: number,
  stats: { completedSessions: number; streakWeeks: number; uniqueTrainingDays: number },
): ProgressGoal[] {
  const { sessionsTarget, streakTarget, trainingDaysTarget } = getLevelRequirements(workingLevel);
  return [
    {
      id: `streak-${workingLevel}`,
      title: "Streak",
      description: `Tren minst én gang i ${streakTarget} uker etter hverandre`,
      current: stats.streakWeeks,
      target: streakTarget,
      unlocked: stats.streakWeeks >= streakTarget,
    },
    {
      id: `sessions-${workingLevel}`,
      title: "Fullførte økter",
      description: `Logg ${sessionsTarget} fullførte økter totalt`,
      current: stats.completedSessions,
      target: sessionsTarget,
      unlocked: stats.completedSessions >= sessionsTarget,
    },
    {
      id: `days-${workingLevel}`,
      title: "Ulike treningsdager",
      description: `Tren på minst ${trainingDaysTarget} forskjellige dager`,
      current: stats.uniqueTrainingDays,
      target: trainingDaysTarget,
      unlocked: stats.uniqueTrainingDays >= trainingDaysTarget,
    },
  ];
}

function formatWeekShortLabel(weekDate: Date, isCurrentWeek: boolean): string {
  if (isCurrentWeek) return "Nå";
  return weekDate.toLocaleDateString("nb-NO", { day: "numeric", month: "short" });
}

export function buildRecentStreakWeeks(
  nowDate: Date,
  trainingWeekKeys: string[],
  activeStreakWeekKeys: Set<string>,
): RecentStreakWeek[] {
  const trainedSet = new Set(trainingWeekKeys);
  const monday = new Date(nowDate);
  const day = (monday.getDay() + 6) % 7;
  monday.setHours(12, 0, 0, 0);
  monday.setDate(monday.getDate() - day);
  const items: RecentStreakWeek[] = [];
  for (let offset = 7; offset >= 0; offset -= 1) {
    const weekDate = new Date(monday);
    weekDate.setDate(weekDate.getDate() - offset * 7);
    const key = getWeekKey(weekDate);
    items.push({
      key,
      shortLabel: formatWeekShortLabel(weekDate, offset === 0),
      trained: trainedSet.has(key),
      inActiveStreak: activeStreakWeekKeys.has(key),
    });
  }
  return items;
}

export function buildStreakSubline(
  streakWeeks: number,
  streakMilestoneTarget: number,
  workingLevel: number,
  nowDate: Date,
  trainingWeekKeys: string[],
): string {
  if (streakWeeks === 0) {
    return "Fullfør én økt denne uken — da starter streaken din.";
  }
  const trainedThisWeek = trainingWeekKeys.includes(getWeekKey(nowDate));
  if (!trainedThisWeek) {
    return "Du har fortsatt en rekke fra tidligere uker. Logg én økt denne uken for å holde den.";
  }
  if (streakWeeks >= streakMilestoneTarget) {
    return "Flott — streaken din er god nok for dette steget. Fortsett jevnt!";
  }
  const remaining = streakMilestoneTarget - streakWeeks;
  return remaining === 1
    ? "Én uke til med minst én økt — da når du ukemålet for dette steget."
    : `${remaining} uker til med minst én økt per uke — da når du ukemålet for steg ${workingLevel}.`;
}

export function buildMonthHabitGoal(
  sessionsPerWeekTarget: number,
  estimatedSessionsThisMonth: number,
): MonthHabitGoal {
  const monthTargetFromProfile = Number(sessionsPerWeekTarget) > 0 ? Number(sessionsPerWeekTarget) * 4 : 10;
  const target = Math.max(8, Math.min(24, monthTargetFromProfile));
  const current = estimatedSessionsThisMonth;
  const unlocked = current >= target;
  const remaining = Math.max(0, target - current);
  let encouragement = "Bygg jevnt videre gjennom måneden.";
  if (unlocked) {
    encouragement = "Månedsmålet er nådd — bra jobbet!";
  } else if (remaining <= 2) {
    encouragement = remaining === 1 ? "Bare én økt igjen denne måneden!" : "To økter igjen — du er nær målet.";
  } else if (current === 0) {
    encouragement = "Logg første økt for å komme i gang.";
  }
  return { current, target, unlocked, encouragement };
}

export function computeMemberProgressState(input: {
  completedLogDates: Date[];
  nowDate: Date;
  sessionsPerWeekTarget: number;
}): MemberProgressState {
  const trainingWeekKeys = Array.from(new Set(input.completedLogDates.map((date) => getWeekKey(date)))).sort().reverse();
  const streakWeeks = computeStreakWeeks(trainingWeekKeys);
  const activeStreakWeekKeys = computeActiveStreakWeekKeys(trainingWeekKeys);
  const completedSessions = input.completedLogDates.length;
  const uniqueTrainingDays = new Set(input.completedLogDates.map((date) => date.toDateString())).size;
  const achievedLevel = computeAchievedLevel(completedSessions, streakWeeks, uniqueTrainingDays);
  const hasCompletedAllLevels = achievedLevel >= ACHIEVEMENT_MAX_LEVEL;
  const workingLevel = hasCompletedAllLevels ? ACHIEVEMENT_MAX_LEVEL : achievedLevel + 1;
  const streakMilestoneTarget = getLevelRequirements(workingLevel).streakTarget;
  const estimatedSessionsThisMonth = input.completedLogDates.filter(
    (date) => date.getMonth() === input.nowDate.getMonth() && date.getFullYear() === input.nowDate.getFullYear(),
  ).length;

  return {
    streakWeeks,
    activeStreakWeekKeys,
    achievedLevel,
    workingLevel,
    hasCompletedAllLevels,
    stepLabel: getProgressStepLabel(workingLevel),
    nextStepLabel: hasCompletedAllLevels ? null : getProgressStepLabel(workingLevel + 1),
    goals: buildProgressGoals(workingLevel, { completedSessions, streakWeeks, uniqueTrainingDays }),
    streakSubline: buildStreakSubline(streakWeeks, streakMilestoneTarget, workingLevel, input.nowDate, trainingWeekKeys),
    recentStreakWeeks: buildRecentStreakWeeks(input.nowDate, trainingWeekKeys, activeStreakWeekKeys),
    streakMilestoneTarget,
    monthGoal: buildMonthHabitGoal(input.sessionsPerWeekTarget, estimatedSessionsThisMonth),
  };
}

export function buildCelebrationCopy(achievedLevel: number): { title: string; body: string } {
  const label = getProgressStepLabel(achievedLevel);
  if (achievedLevel >= ACHIEVEMENT_MAX_LEVEL) {
    return {
      title: "Du har nådd siste steg",
      body: `Gratulerer — du er «${label}». Du holder jevn streak, mange økter og god variasjon over tid.`,
    };
  }
  return {
    title: `Nytt steg: ${label}`,
    body: `Du har tatt steg ${achievedLevel} av ${ACHIEVEMENT_MAX_LEVEL}. Fortsett med jevn trening — neste steg er «${getProgressStepLabel(achievedLevel + 1)}».`,
  };
}
