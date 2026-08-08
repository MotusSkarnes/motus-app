import type { ScoreTrend } from "./memberMomentumScores";
import { getWeekdayShortLabel } from "./memberTrainingCalendar";

const WEEKDAY_PLURAL = [
  "mandager",
  "tirsdager",
  "onsdager",
  "torsdager",
  "fredager",
  "lørdager",
  "søndager",
] as const;

export type HomeWeekHeadline = {
  headline: string;
  subline: string;
};

export type HomeWeekMotivation = {
  title: string;
  detail: string;
};

export type HomeWeekInsight = {
  title: string;
  detail: string;
};

export type HomeWeekFlow = {
  title: string;
  detail: string;
  streakLabel: string | null;
};

function getStartOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function computeWeekProgressPct(completed: number, planned: number, weeklyTarget?: number): number {
  if (planned > 0) return Math.min(100, Math.round((completed / planned) * 100));
  const target = Math.max(1, weeklyTarget ?? 3);
  if (completed > 0) return Math.min(100, Math.round((completed / target) * 100));
  return 0;
}

export function shouldOfferCreateHomeWeekPlan(input: {
  homeWorkoutHydrationPending: boolean;
  hasPlannedWorkoutInUpcomingWeek: boolean;
}): boolean {
  return !input.homeWorkoutHydrationPending && !input.hasPlannedWorkoutInUpcomingWeek;
}

export function buildHomeWeekHeadline(
  completed: number,
  planned: number,
  progressPct: number,
  momentumTrend: ScoreTrend,
): HomeWeekHeadline {
  if (completed === 0 && planned === 0) {
    return { headline: "Ny uke", subline: "Start når det passer — hver økt teller." };
  }
  if (progressPct >= 100) {
    return { headline: "Fullført uke! 🎯", subline: "Planen er i boks — sterk innsats." };
  }
  if (planned > 0 && completed >= planned) {
    return { headline: "Sterk uke! 💪", subline: "Du er foran planen denne uka." };
  }
  if (planned > 0 && progressPct >= 70) {
    return { headline: "Sterk uke! 💪", subline: "Du er foran planen denne uka." };
  }
  if (momentumTrend === "up" && completed > 0) {
    return { headline: "Bygger rutiner 🔥", subline: "Du trener mer enn forrige uke." };
  }
  if (completed > 0) {
    return { headline: "God start", subline: "Fortsett jevnt — du er på vei." };
  }
  return { headline: "Klar for uka", subline: "Planen ligger klar når du er." };
}

export function buildHomeWeekMotivation(input: {
  completed: number;
  planned: number;
  progressPct: number;
  momentumTrend: ScoreTrend;
  thisWeekSessions: number;
  lastWeekSessions: number;
  streakWeeks: number;
  weekDays: Array<{ status: string; isToday: boolean; date: Date }>;
  nowDate: Date;
}): HomeWeekMotivation | null {
  const remaining = input.planned > 0 ? Math.max(0, input.planned - input.completed) : 0;
  const today = getStartOfDay(input.nowDate);

  if (remaining === 1) {
    const nextPlanned = input.weekDays.find((day) => {
      if (day.status !== "planned") return false;
      const dayStart = getStartOfDay(day.date);
      return dayStart.getTime() >= today.getTime();
    });
    const nextPending = nextPlanned ?? input.weekDays.find((day) => {
      if (day.status === "completed") return false;
      const dayStart = getStartOfDay(day.date);
      return dayStart.getTime() >= today.getTime();
    });
    const dayLabel = nextPending ? getWeekdayShortLabel(nextPending.date).toLowerCase() : "Snart";
    return {
      title: "Én økt unna full uke",
      detail: `${dayLabel.charAt(0).toUpperCase()}${dayLabel.slice(1)} avgjør — du klarer det!`,
    };
  }

  if (input.momentumTrend === "up" && input.thisWeekSessions - input.lastWeekSessions >= 2) {
    const diff = input.thisWeekSessions - input.lastWeekSessions;
    return {
      title: `${diff} økter mer enn forrige uke`,
      detail: "Du bygger gode vaner — hold flyten.",
    };
  }

  if (input.progressPct >= 100) {
    return { title: "Ny rekorduke!", detail: "Planen er fullført — nyt resten av uka." };
  }

  if (input.streakWeeks >= 4) {
    return { title: "Stabil trening denne måneden", detail: "Du holder koken — imponerende jevnhet." };
  }

  if (input.completed > 0 && input.planned > 0 && input.progressPct >= 50) {
    return { title: "Du holder koken 🔥", detail: "Halvparten av uka er i boks — fortsett sånn." };
  }

  if (input.completed === 0 && input.planned > 0) {
    return { title: "Uka venter på deg", detail: "Én økt i dag setter tonen for resten av uka." };
  }

  return null;
}

export function buildHomeWeekInsight(completedLogDates: Date[], nowDate: Date): HomeWeekInsight {
  const today = getStartOfDay(nowDate);
  const windowStart = new Date(today);
  windowStart.setDate(windowStart.getDate() - 56);

  const counts = [0, 0, 0, 0, 0, 0, 0];
  completedLogDates.forEach((date) => {
    const day = getStartOfDay(date);
    if (day.getTime() < windowStart.getTime() || day.getTime() > today.getTime()) return;
    counts[(day.getDay() + 6) % 7] += 1;
  });

  const total = counts.reduce((sum, value) => sum + value, 0);
  if (total < 3) {
    return {
      title: "Du bygger gode vaner",
      detail: "Logg noen økter til — da viser vi hvilke dager du trener mest.",
    };
  }

  const ranked = counts
    .map((count, index) => ({ count, index }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count);

  const top = ranked.slice(0, 2);
  if (top.length === 1) {
    return {
      title: "Du bygger gode vaner",
      detail: `Du trener mest konsekvent på ${WEEKDAY_PLURAL[top[0].index]}.`,
    };
  }

  return {
    title: "Du bygger gode vaner",
    detail: `Du trener mest konsekvent på ${WEEKDAY_PLURAL[top[0].index]} og ${WEEKDAY_PLURAL[top[1].index]}.`,
  };
}

export function buildHomeWeekFlow(streakWeeks: number, streakSubline: string): HomeWeekFlow {
  const title = streakWeeks >= 4 ? "Sterk flyt" : streakWeeks > 0 ? "Stabil flyt" : "Bygg streak";
  const detail =
    streakWeeks > 0 ? streakSubline.trim() || "Hold flyten gående!" : "Fullfør én økt denne uka for å starte.";
  const streakLabel =
    streakWeeks > 0 ? `${streakWeeks} ${streakWeeks === 1 ? "uke" : "uker"} på rad` : null;

  return { title, detail, streakLabel };
}

export function formatSessionStat(completed: number, planned: number, weeklyTarget?: number): string {
  const target = Math.max(planned, weeklyTarget ?? 0, completed > 0 ? completed : 0, 1);
  return `${completed} av ${target}`;
}
