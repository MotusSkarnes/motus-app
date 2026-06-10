import { useMemo, useState } from "react";
import {
  Activity,
  ArrowLeft,
  Check,
  ChevronRight,
  Dumbbell,
  Flame,
  MoreVertical,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  Trophy,
} from "lucide-react";
import { parseStoredLogDate } from "../app/dateFormat";
import { resolveExerciseImageSrc } from "../app/exerciseIllustrations";
import { imageObjectPositionFromSrc } from "../app/imageFocalPoint";
import {
  computeConsistencyHeatmap,
  computeHistoryPeriodStats,
  computeWeeklyWorkoutBars,
  estimateLogTrainingMinutesForDisplay,
  formatTrainingDuration,
  topLoggedExercises,
  type HistoryPeriodWeeks,
} from "../app/memberTrainingHistory";
import {
  resolveFirstProgramCoverExercise,
  resolveProgramImageSrc,
  STRENGTH_TRAINING_COVER_IMAGE,
} from "../app/programImage";
import { resolveProgressExerciseDisplayName, resolveProgressPersonalRecordImage } from "../app/progressImagery";
import type { Exercise, TrainingProgram, WorkoutLog } from "../app/types";
import { EmptyState, GradientButton } from "../app/ui";
import type { PersonalRecordEntry } from "./MemberPersonalRecordsSection";
import { MuscleSplitCard } from "./MuscleSplitCard";
import type { MuscleGroupStat, MuscleSplitMetric, MuscleSplitPeriod } from "./muscleSplitStats";
import {
  MemberWorkoutHistoryLogList,
  type EditingLoggedExerciseDraft,
  type MemberWorkoutHistoryLogListProps,
} from "./MemberWorkoutHistoryLogList";

export type HistoryTab = "oversikt" | "okter" | "ovelser" | "fremgang" | "kropp";

const PERIOD_OPTIONS: Array<{ value: HistoryPeriodWeeks; label: string }> = [
  { value: 4, label: "Siste 4 uker" },
  { value: 12, label: "Siste 12 uker" },
  { value: 26, label: "Siste 26 uker" },
];

const HEATMAP_WEEKDAYS = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"] as const;

type MemberTrainingHistoryViewProps = {
  memberLogs: WorkoutLog[];
  completedLogs: WorkoutLog[];
  allLogsForSessions: WorkoutLog[];
  personalRecords: PersonalRecordEntry[];
  exercises: Exercise[];
  programs: TrainingProgram[];
  nowTimestamp: number;
  streakWeeks: number;
  muscleSplitStats: MuscleGroupStat[];
  muscleSplitMetric: MuscleSplitMetric;
  muscleSplitPeriod: MuscleSplitPeriod;
  onMuscleSplitMetricChange: (metric: MuscleSplitMetric) => void;
  onMuscleSplitPeriodChange: (period: MuscleSplitPeriod) => void;
  onOpenProgress: () => void;
  onOpenProgressExercise: (name: string) => void;
  focusLogId?: string | null;
  logListProps: Omit<MemberWorkoutHistoryLogListProps, "logs">;
};

type HistoryView = "overview" | "sessions" | "exercises" | "body";

function resolveRecordImage(name: string, exercises: Exercise[]): string {
  const progressPhoto = resolveProgressPersonalRecordImage(name);
  if (progressPhoto) return progressPhoto;
  const normalized = name.trim().toLowerCase();
  const match = exercises.find((exercise) => exercise.name.trim().toLowerCase() === normalized);
  if (match) return resolveExerciseImageSrc(match);
  return STRENGTH_TRAINING_COVER_IMAGE;
}

function resolveLogCoverImage(log: WorkoutLog, programs: TrainingProgram[], exercises: Exercise[]): string {
  const program =
    programs.find((item) => item.title.trim().toLowerCase() === log.programTitle.trim().toLowerCase()) ?? null;
  const coverExercise = program
    ? resolveFirstProgramCoverExercise(program, exercises)
    : exercises.find((exercise) =>
        (log.results ?? []).some((result) => result.exerciseName.trim().toLowerCase() === exercise.name.trim().toLowerCase()),
      );
  if (program) {
    return resolveProgramImageSrc(program, coverExercise ?? null);
  }
  if (coverExercise) return resolveExerciseImageSrc(coverExercise);
  return STRENGTH_TRAINING_COVER_IMAGE;
}

function formatLogDateLabel(date: string): string {
  const parsed = parseStoredLogDate(date);
  if (!parsed) return date;
  return parsed.toLocaleDateString("no-NO", { day: "numeric", month: "long", year: "numeric" });
}

function formatShortPeriodDelta(value: number): string {
  if (value === 0) return "0 fra forrige periode";
  const sign = value > 0 ? "+" : "-";
  return `${sign}${Math.abs(value).toLocaleString("nb-NO")} fra forrige periode`;
}

function formatMinutesDelta(minutes: number): string {
  if (minutes === 0) return "0 fra forrige periode";
  const sign = minutes > 0 ? "+" : "";
  return `${sign}${formatTrainingDuration(Math.abs(minutes))} fra forrige periode`;
}

function formatPeriodBadge(stats: ReturnType<typeof computeHistoryPeriodStats>): string | null {
  if (stats.workoutsDelta > 0 && stats.trainingMinutesDelta > 0) return "Sterkeste periode hittil! 🔥";
  if (stats.workoutsDelta > 0) return "Flere økter enn forrige periode 💪";
  if (stats.personalRecordsDelta > 0) return "Nye rekorder i perioden 🎯";
  return null;
}

export function MemberTrainingHistoryView({
  memberLogs,
  completedLogs,
  allLogsForSessions,
  personalRecords,
  exercises,
  programs,
  nowTimestamp,
  streakWeeks,
  muscleSplitStats,
  muscleSplitMetric,
  muscleSplitPeriod,
  onMuscleSplitMetricChange,
  onMuscleSplitPeriodChange,
  onOpenProgress,
  onOpenProgressExercise,
  focusLogId,
  logListProps,
}: MemberTrainingHistoryViewProps) {
  const [view, setView] = useState<HistoryView>("overview");
  const [periodWeeks, setPeriodWeeks] = useState<HistoryPeriodWeeks>(12);

  const periodStats = useMemo(
    () => computeHistoryPeriodStats(completedLogs, periodWeeks, nowTimestamp),
    [completedLogs, periodWeeks, nowTimestamp],
  );
  const weeklyBars = useMemo(() => computeWeeklyWorkoutBars(completedLogs, 12, nowTimestamp), [completedLogs, nowTimestamp]);
  const heatmapMonths = useMemo(
    () => computeConsistencyHeatmap(completedLogs, 4, nowTimestamp),
    [completedLogs, nowTimestamp],
  );
  const visibleHeatmapMonths = useMemo(() => [...heatmapMonths].reverse(), [heatmapMonths]);
  const topExercises = useMemo(() => topLoggedExercises(completedLogs, 12), [completedLogs]);
  const periodBadge = useMemo(() => formatPeriodBadge(periodStats), [periodStats]);

  const consistencySummary = useMemo(() => {
    const today = new Date(nowTimestamp);
    const currentMonth = heatmapMonths[heatmapMonths.length - 1];
    const activeDaysThisMonth =
      currentMonth?.cells.filter((cell) => cell && cell.count > 0).length ?? 0;
    const daysSoFar = today.getDate();
    const consistencyPct = daysSoFar > 0 ? Math.min(100, Math.round((activeDaysThisMonth / daysSoFar) * 100)) : 0;
    const bestWeek = Math.max(0, ...weeklyBars.map((bar) => bar.count));
    return { activeDaysThisMonth, consistencyPct, bestWeek };
  }, [heatmapMonths, nowTimestamp, weeklyBars]);

  const recentWorkoutCards = useMemo(
    () =>
      [...memberLogs]
        .sort((a, b) => (parseStoredLogDate(b.date)?.getTime() ?? 0) - (parseStoredLogDate(a.date)?.getTime() ?? 0))
        .slice(0, 5),
    [memberLogs],
  );
  const recordPreview = personalRecords.slice(0, 8);
  const streakLabel = streakWeeks > 0 ? `${streakWeeks} ${streakWeeks === 1 ? "uke" : "uker"}` : "0 uker";

  if (view !== "overview") {
    return (
      <div className="motus-member-history motus-fade-in-up">
        <button
          type="button"
          onClick={() => setView("overview")}
          className="motus-member-history-back motus-pressable"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Tilbake til historikk
        </button>

        {view === "sessions" ? (
          <section className="motus-member-history-card">
            <div className="motus-member-history-card-head">
              <h3 className="motus-member-history-section-title">Alle økter</h3>
              <span className="text-xs text-slate-500">{allLogsForSessions.length} loggførte økter</span>
            </div>
            <MemberWorkoutHistoryLogList logs={allLogsForSessions} focusLogId={focusLogId} {...logListProps} />
          </section>
        ) : null}

        {view === "exercises" ? (
          <section className="motus-member-history-card">
            <div className="motus-member-history-card-head">
              <h3 className="motus-member-history-section-title">Mest loggede øvelser</h3>
              <span className="motus-member-history-chip">Basert på fullførte økter</span>
            </div>
            {topExercises.length === 0 ? (
              <EmptyState
                icon="💪"
                title="Ingen øvelser logget"
                description="Når du logger sett i økter, vises de mest brukte øvelsene her."
                className="mt-3 bg-slate-50/80"
              />
            ) : (
              <div className="motus-member-history-exercise-list">
                {topExercises.map((exercise, index) => (
                  <div key={exercise.name} className="motus-member-history-exercise-row">
                    <span className="motus-member-history-exercise-rank">{index + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-slate-900">{exercise.name}</div>
                      <div className="text-xs text-slate-500">
                        {exercise.sessions} {exercise.sessions === 1 ? "økt" : "økter"} · {exercise.sets} sett
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onOpenProgressExercise(exercise.name)}
                      className="motus-member-history-link shrink-0"
                    >
                      Fremgang
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        ) : null}

        {view === "body" ? (
          <section className="motus-member-history-card motus-member-history-card--flush">
            <MuscleSplitCard
              stats={muscleSplitStats}
              metric={muscleSplitMetric}
              period={muscleSplitPeriod}
              onMetricChange={onMuscleSplitMetricChange}
              onPeriodChange={onMuscleSplitPeriodChange}
            />
          </section>
        ) : null}
      </div>
    );
  }

  return (
    <div className="motus-member-history motus-fade-in-up">
      <section className="motus-member-history-hero" aria-label="Historikk">
        <div className="motus-member-history-hero-bg" aria-hidden />
        <div className="motus-member-history-hero-chart" aria-hidden>
          <svg viewBox="0 0 320 64" preserveAspectRatio="none">
            <polyline
              fill="none"
              stroke="rgba(255,255,255,0.35)"
              strokeWidth="2"
              strokeLinecap="round"
              points="0,48 40,42 80,36 120,28 160,32 200,20 240,24 280,14 320,18"
            />
          </svg>
        </div>
        <div className="motus-member-history-hero-body">
          <div className="motus-member-history-hero-top">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="motus-member-history-hero-title">Historikk</h2>
                <Sparkles className="h-5 w-5 shrink-0 text-[#ff4da6]" aria-hidden />
              </div>
              <p className="motus-member-history-hero-subtitle">Se utviklingen din over tid</p>
            </div>
            <div className="motus-member-history-hero-ring" aria-label={`${streakLabel} på rad`}>
              <svg viewBox="0 0 80 80" className="motus-member-history-hero-ring-svg" aria-hidden>
                <circle cx="40" cy="40" r="30" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="3" />
                <circle
                  cx="40"
                  cy="40"
                  r="30"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={`${Math.max(14, Math.min(188, streakWeeks > 0 ? 188 : 36))} 188`}
                  transform="rotate(-90 40 40)"
                />
              </svg>
              <div className="motus-member-history-hero-ring-center">
                <Flame className="motus-member-history-hero-flame" strokeWidth={2.25} aria-hidden />
                <span className="motus-member-history-hero-ring-value">{streakWeeks}</span>
                <span className="motus-member-history-hero-ring-label">
                  {streakWeeks === 1 ? "uke" : "uker"}
                </span>
              </div>
            </div>
          </div>
          {periodBadge ? <span className="motus-member-history-hero-badge">{periodBadge}</span> : null}
        </div>
      </section>

      <div className="motus-member-history-stack">
        <section className="motus-member-history-card">
          <div className="motus-member-history-card-head">
            <h3 className="motus-member-history-section-title">Dine resultater</h3>
            <select
              value={periodWeeks}
              onChange={(event) => setPeriodWeeks(Number(event.target.value) as HistoryPeriodWeeks)}
              className="motus-member-history-select"
              aria-label="Velg periode"
            >
              {PERIOD_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="motus-member-history-kpi-row">
            <article className="motus-member-history-kpi-card">
              <div className="motus-member-history-kpi-icon motus-member-history-kpi-icon--teal">
                <Target className="h-3.5 w-3.5" aria-hidden />
              </div>
              <div className="motus-member-history-kpi-main">
                <span className="motus-member-history-kpi-value">{periodStats.workouts}</span>
                <span className="motus-member-history-kpi-label">Økter</span>
              </div>
              <div className={`motus-member-history-kpi-delta is-teal ${periodStats.workoutsDelta >= 0 ? "is-positive" : ""}`}>
                {formatShortPeriodDelta(periodStats.workoutsDelta)}
              </div>
            </article>
            <article className="motus-member-history-kpi-card">
              <div className="motus-member-history-kpi-icon motus-member-history-kpi-icon--pink">
                <Flame className="h-3.5 w-3.5" aria-hidden />
              </div>
              <div className="motus-member-history-kpi-main">
                <span className="motus-member-history-kpi-value">{formatTrainingDuration(periodStats.trainingMinutes)}</span>
                <span className="motus-member-history-kpi-label">Treningstid</span>
              </div>
              <div className={`motus-member-history-kpi-delta is-pink ${periodStats.trainingMinutesDelta >= 0 ? "is-positive" : ""}`}>
                {formatMinutesDelta(periodStats.trainingMinutesDelta)}
              </div>
            </article>
            <article className="motus-member-history-kpi-card">
              <div className="motus-member-history-kpi-icon motus-member-history-kpi-icon--violet">
                <Trophy className="h-3.5 w-3.5" aria-hidden />
              </div>
              <div className="motus-member-history-kpi-main">
                <span className="motus-member-history-kpi-value">{periodStats.personalRecords}</span>
                <span className="motus-member-history-kpi-label">Rekorder</span>
              </div>
              <div className={`motus-member-history-kpi-delta is-pink ${periodStats.personalRecordsDelta >= 0 ? "is-positive" : ""}`}>
                {formatShortPeriodDelta(periodStats.personalRecordsDelta)}
              </div>
            </article>
          </div>
        </section>

        <section className="motus-member-history-card">
          <div className="motus-member-history-card-head">
            <h3 className="motus-member-history-section-title">Kontinuitet</h3>
            <span className="motus-member-history-chip">Siste 4 måneder</span>
          </div>

          {streakWeeks > 0 ? (
            <div className="motus-member-history-consistency-banner">
              <span className="motus-member-history-consistency-banner-icon" aria-hidden>
                <Flame className="h-5 w-5" strokeWidth={2.25} />
              </span>
              <p className="motus-member-history-consistency-banner-text">
                Du har en streak på {streakLabel}! Utrolig innsats – fortsett sånn! 💪
              </p>
            </div>
          ) : null}

          <div className="motus-member-history-heatmap">
            {visibleHeatmapMonths.map((month) => (
              <div key={month.label} className="motus-member-history-heatmap-month">
                <div className="motus-member-history-heatmap-label">{month.label}</div>
                <div className="motus-member-history-heatmap-weekdays-row" aria-hidden>
                  {HEATMAP_WEEKDAYS.map((day) => (
                    <span key={day}>{day.charAt(0)}</span>
                  ))}
                </div>
                <div className="motus-member-history-heatmap-grid">
                  {month.cells.map((cell, index) =>
                    cell ? (
                      <span
                        key={cell.dateKey}
                        className={`motus-member-history-heatmap-cell level-${cell.level}${cell.count > 0 ? " has-activity" : ""}`}
                        title={`${cell.dateKey}: ${cell.count} ${cell.count === 1 ? "økt" : "økter"}`}
                      />
                    ) : (
                      <span key={`empty-${month.label}-${index}`} className="motus-member-history-heatmap-cell level-empty" aria-hidden />
                    ),
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="motus-member-history-heatmap-legend">
            <span>Lite</span>
            <span className="motus-member-history-heatmap-cell level-0" />
            <span className="motus-member-history-heatmap-cell level-1" />
            <span className="motus-member-history-heatmap-cell level-2" />
            <span className="motus-member-history-heatmap-cell level-3" />
            <span className="motus-member-history-heatmap-cell level-4" />
            <span>Høy</span>
          </div>

          <div className="motus-member-history-consistency-stats">
            <div className="motus-member-history-consistency-stat">
              <Check className="h-4 w-4 shrink-0 text-[#0e8f73]" aria-hidden />
              <span>{consistencySummary.activeDaysThisMonth} dager denne mnd.</span>
            </div>
            <div className="motus-member-history-consistency-stat">
              <TrendingUp className="h-4 w-4 shrink-0 text-[#d91278]" aria-hidden />
              <span>{consistencySummary.consistencyPct}% kontinuitet</span>
            </div>
            <div className="motus-member-history-consistency-stat">
              <Star className="h-4 w-4 shrink-0 text-[#7c3aed]" aria-hidden />
              <span>{consistencySummary.bestWeek} økter beste uke</span>
            </div>
          </div>
        </section>

        <section className="motus-member-history-card">
          <div className="motus-member-history-card-head">
            <h3 className="motus-member-history-section-title">Personlige rekorder</h3>
            <button type="button" onClick={onOpenProgress} className="motus-member-history-link motus-member-history-link--pink">
              Se alle
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
          {recordPreview.length === 0 ? (
            <EmptyState
              icon="🏅"
              title="Ingen PR-er ennå"
              description="Logg styrkeøkter for å se personlige rekorder."
              className="mt-3 bg-slate-50/80"
            />
          ) : (
            <>
              <div className="motus-member-history-pr-scroll scrollbar-none">
                {recordPreview.map((record) => {
                  const imageSrc = resolveRecordImage(record.name, exercises);
                  const displayName = resolveProgressExerciseDisplayName(record.name);
                  return (
                    <button
                      key={record.name}
                      type="button"
                      onClick={() => onOpenProgressExercise(record.name)}
                      className="motus-member-history-pr-card motus-pressable"
                    >
                      <div className="motus-member-history-pr-card-top">
                        <div className="motus-member-history-pr-image">
                          <img src={imageSrc} alt="" className="motus-member-history-pr-image-media" loading="lazy" />
                        </div>
                        <span className="motus-member-history-pr-menu" aria-hidden>
                          <MoreVertical className="h-4 w-4" />
                        </span>
                      </div>
                      <div className="motus-member-history-pr-body">
                        <div className="motus-member-history-pr-name">{displayName}</div>
                        <div className="motus-member-history-pr-weight">
                          {record.weight} kg{record.reps ? ` · ${record.reps} reps` : ""}
                        </div>
                        <div className="motus-member-history-pr-badge-slot">
                          {record.isNewRecord ? <div className="motus-member-history-pr-badge">Ny rekord! 🎉</div> : null}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="motus-member-history-pr-dots" aria-hidden>
                {recordPreview.slice(0, 5).map((record, index) => (
                  <span key={record.name} className={index === 0 ? "is-active" : ""} />
                ))}
              </div>
            </>
          )}
        </section>

        <section className="motus-member-history-card">
          <div className="motus-member-history-card-head">
            <h3 className="motus-member-history-section-title">Nylige økter</h3>
            <button type="button" onClick={() => setView("sessions")} className="motus-member-history-link motus-member-history-link--pink">
              Se alle
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
          {recentWorkoutCards.length === 0 ? (
            <EmptyState
              icon="🏋️"
              title="Ingen økter ennå"
              description="Start en økt for å se den i historikken."
              className="mt-3 bg-slate-50/80"
            />
          ) : (
            <div className="motus-member-history-session-list">
              {recentWorkoutCards.map((log) => {
                const imageSrc = resolveLogCoverImage(log, programs, exercises);
                const minutes = estimateLogTrainingMinutesForDisplay(log);
                const isDone = log.status === "Fullført";
                return (
                  <button
                    key={log.id}
                    type="button"
                    onClick={() => {
                      setView("sessions");
                      logListProps.onToggleExpanded(log.id);
                    }}
                    className="motus-member-history-session-row motus-pressable"
                  >
                    <div className="motus-member-history-session-thumb motus-image-frame">
                      <img
                        src={imageSrc}
                        alt=""
                        className="motus-image-media"
                        loading="lazy"
                        style={{ objectPosition: imageObjectPositionFromSrc(imageSrc) }}
                      />
                    </div>
                    <div className="min-w-0 flex-1 text-left">
                      <div className="motus-member-history-session-title">{log.programTitle}</div>
                      <div className="motus-member-history-session-meta">
                        {minutes} min · {formatLogDateLabel(log.date)}
                      </div>
                    </div>
                    <span className={`motus-member-history-status ${isDone ? "is-done" : "is-planned"}`}>
                      {isDone ? "Fullført" : log.status}
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" aria-hidden />
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <div className="motus-member-history-footer-links">
          <button type="button" onClick={() => setView("exercises")} className="motus-member-history-footer-link motus-pressable">
            <Dumbbell className="h-4 w-4" aria-hidden />
            Øvelser
          </button>
          <button type="button" onClick={() => setView("body")} className="motus-member-history-footer-link motus-pressable">
            <Activity className="h-4 w-4" aria-hidden />
            Kropp
          </button>
          <GradientButton type="button" onClick={onOpenProgress} className="h-10 flex-1 rounded-xl px-4 text-xs font-semibold">
            Åpne fremgang
          </GradientButton>
        </div>
      </div>
    </div>
  );
}

export type { EditingLoggedExerciseDraft };
