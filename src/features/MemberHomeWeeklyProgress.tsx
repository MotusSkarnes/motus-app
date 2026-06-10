import { useEffect, useId, useMemo, useState } from "react";
import { BarChart3, Check, ChevronRight, Clock3, Flame, Sparkles, Trophy } from "lucide-react";
import {
  buildHomeWeekHeadline,
  buildHomeWeekInsight,
  buildHomeWeekMotivation,
  computeWeekProgressPct,
  formatSessionStat,
} from "../app/memberHomeWeekInsights";
import type { ScoreTrend } from "../app/memberMomentumScores";
import { getWeekdayShortLabel } from "../app/memberTrainingCalendar";
import type { TrainingCalendarDayModel } from "./MemberTrainingCalendar";

const RING_RADIUS = 54;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function getStartOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

type MemberHomeWeeklyProgressProps = {
  weekDays: TrainingCalendarDayModel[];
  completedSessions: number;
  plannedSessions: number;
  weeklyTarget?: number;
  weeklyMinutes: number;
  streakWeeks: number;
  streakSubline: string;
  momentumTrend: ScoreTrend;
  thisWeekSessions: number;
  lastWeekSessions: number;
  completedLogDates: Date[];
  nowDate: Date;
  onOpenCalendar: () => void;
  showStats?: boolean;
};

function WeekProgressRing({ pct }: { pct: number }) {
  const gradientId = useId();
  const glowId = `${gradientId}-glow`;
  const [animatedPct, setAnimatedPct] = useState(0);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setAnimatedPct(pct));
    return () => window.cancelAnimationFrame(frame);
  }, [pct]);

  const dashOffset = RING_CIRCUMFERENCE - (RING_CIRCUMFERENCE * animatedPct) / 100;

  return (
    <div className="motus-home-week-ring" aria-hidden>
      <svg viewBox="0 0 128 128" className="motus-home-week-ring-svg">
        <defs>
          <linearGradient id={gradientId} x1="8%" y1="92%" x2="92%" y2="8%">
            <stop offset="0%" stopColor="#27E0C1" />
            <stop offset="100%" stopColor="#FF2D95" />
          </linearGradient>
          <filter id={glowId} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <circle cx="64" cy="64" r={RING_RADIUS} fill="none" stroke="rgba(15,23,42,0.06)" strokeWidth="10" />
        <circle
          cx="64"
          cy="64"
          r={RING_RADIUS}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={RING_CIRCUMFERENCE}
          strokeDashoffset={dashOffset}
          transform="rotate(-90 64 64)"
          filter={`url(#${glowId})`}
          className="motus-home-week-ring-fill"
        />
      </svg>
      <Sparkles className="motus-home-week-ring-spark motus-home-week-ring-spark--one" aria-hidden />
      <Sparkles className="motus-home-week-ring-spark motus-home-week-ring-spark--two" aria-hidden />
      <div className="motus-home-week-ring-center">
        <span className="motus-home-week-ring-pct">{animatedPct}%</span>
        <span className="motus-home-week-ring-label">uke fullført</span>
      </div>
    </div>
  );
}

export function MemberHomeWeeklyProgress({
  weekDays,
  completedSessions,
  plannedSessions,
  weeklyTarget,
  weeklyMinutes,
  streakWeeks,
  streakSubline,
  momentumTrend,
  thisWeekSessions,
  lastWeekSessions,
  completedLogDates,
  nowDate,
  onOpenCalendar,
  showStats = true,
}: MemberHomeWeeklyProgressProps) {
  const progressPct = useMemo(
    () => computeWeekProgressPct(completedSessions, plannedSessions, weeklyTarget),
    [completedSessions, plannedSessions, weeklyTarget],
  );

  const headline = useMemo(
    () => buildHomeWeekHeadline(completedSessions, plannedSessions, progressPct, momentumTrend),
    [completedSessions, plannedSessions, progressPct, momentumTrend],
  );

  const motivation = useMemo(
    () =>
      buildHomeWeekMotivation({
        completed: completedSessions,
        planned: plannedSessions,
        progressPct,
        momentumTrend,
        thisWeekSessions,
        lastWeekSessions,
        streakWeeks,
        weekDays,
        nowDate,
      }),
    [
      completedSessions,
      plannedSessions,
      progressPct,
      momentumTrend,
      thisWeekSessions,
      lastWeekSessions,
      streakWeeks,
      weekDays,
      nowDate,
    ],
  );

  const insight = useMemo(() => buildHomeWeekInsight(completedLogDates, nowDate), [completedLogDates, nowDate]);

  const weekStripPct = useMemo(() => {
    const done = weekDays.filter((day) => day.status === "completed").length;
    return Math.min(100, Math.round((done / 7) * 100));
  }, [weekDays]);

  return (
    <div className="motus-home-week-stack">
      <section className="motus-home-section-card motus-home-week-card motus-fade-in-up" aria-label="Denne uka">
        <div className="motus-home-week-top">
          <div className="motus-home-week-header">
            <div className="motus-home-week-header-row">
              <p className="motus-home-week-eyebrow">Denne uka</p>
              <button
                type="button"
                onClick={onOpenCalendar}
                className="motus-home-week-calendar-link motus-pressable"
              >
                Kalender
                <ChevronRight className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
            <h2 className="motus-home-week-headline">{headline.headline}</h2>
            <p className="motus-home-week-subline">{headline.subline}</p>
          </div>
          <WeekProgressRing pct={progressPct} />
        </div>

        {showStats ? (
          <div className="motus-home-week-stats">
          <div className="motus-home-week-stat">
            <span className="motus-home-week-stat-icon motus-home-week-stat-icon--time" aria-hidden>
              <Clock3 className="h-4 w-4" />
            </span>
            <span className="motus-home-week-stat-value">{weeklyMinutes.toLocaleString("nb-NO")} min</span>
            <span className="motus-home-week-stat-label">trening</span>
          </div>
          <div className="motus-home-week-stat-divider" aria-hidden />
          <div className="motus-home-week-stat">
            <span className="motus-home-week-stat-icon motus-home-week-stat-icon--sessions" aria-hidden>
              <Check className="h-4 w-4" strokeWidth={3} />
            </span>
            <span className="motus-home-week-stat-value">
              {formatSessionStat(completedSessions, plannedSessions, weeklyTarget)}
            </span>
            <span className="motus-home-week-stat-label">økter fullført</span>
          </div>
          <div className="motus-home-week-stat-divider" aria-hidden />
          <div className="motus-home-week-stat">
            <span className="motus-home-week-stat-icon motus-home-week-stat-icon--streak" aria-hidden>
              <Flame className="h-4 w-4" strokeWidth={2.25} />
            </span>
            <span className="motus-home-week-stat-value">
              {streakWeeks > 0 ? `${streakWeeks} ${streakWeeks === 1 ? "uke" : "uker"}` : "0 uker"}
            </span>
            <span className="motus-home-week-stat-label">på rad</span>
          </div>
          </div>
        ) : null}

        <div className="motus-home-week-strip">
          <div className="motus-home-week-strip-days">
            {weekDays.map((day) => {
              const done = day.status === "completed";
              const pending =
                !done &&
                day.status !== "missed" &&
                (day.isToday || getStartOfDay(day.date).getTime() > getStartOfDay(nowDate).getTime());
              const missed = day.status === "missed";
              return (
                <div
                  key={day.dateKey}
                  className={`motus-home-week-strip-day ${done ? "motus-home-week-strip-day--done" : ""} ${pending ? "motus-home-week-strip-day--pending" : ""} ${missed ? "motus-home-week-strip-day--missed" : ""} ${day.isToday ? "motus-home-week-strip-day--today" : ""}`}
                >
                  <span className="motus-home-week-strip-label">{getWeekdayShortLabel(day.date).slice(0, 3).toUpperCase()}</span>
                  <span className="motus-home-week-strip-dot" aria-hidden>
                    {done ? <Check className="h-2.5 w-2.5" strokeWidth={3} /> : null}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="motus-home-week-strip-track" aria-hidden>
            <div className="motus-home-week-strip-fill" style={{ width: `${weekStripPct}%` }} />
          </div>
        </div>

        {motivation ? (
          <div className="motus-home-week-motivation">
            <span className="motus-home-week-motivation-icon" aria-hidden>
              <Trophy className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="motus-home-week-motivation-title">{motivation.title}</p>
              <p className="motus-home-week-motivation-detail">{motivation.detail}</p>
            </div>
          </div>
        ) : null}
      </section>

      <section className="motus-home-section-card motus-home-week-insight motus-fade-in-up" aria-label="Innsikt">
        <div className="motus-home-week-insight-art" aria-hidden />
        <div className="motus-home-week-insight-body">
          <span className="motus-home-week-insight-icon" aria-hidden>
            <BarChart3 className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="motus-home-week-insight-eyebrow">Innsikt</p>
            <h3 className="motus-home-week-insight-title">{insight.title}</h3>
            <p className="motus-home-week-insight-detail">{insight.detail}</p>
          </div>
        </div>
      </section>
    </div>
  );
}
