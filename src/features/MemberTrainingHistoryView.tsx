import { useMemo, useState } from "react";
import {
  Activity,
  ChevronRight,
  Dumbbell,
  Flame,
  History,
  Trophy,
  Zap,
} from "lucide-react";
import { MOTUS } from "../app/data";
import { parseStoredLogDate } from "../app/dateFormat";
import { resolveExerciseImageSrc } from "../app/exerciseIllustrations";
import { imageObjectPositionFromSrc } from "../app/imageFocalPoint";
import {
  computeConsistencyHeatmap,
  computeHistoryPeriodStats,
  computeWeeklyAverageInsight,
  computeWeeklyWorkoutBars,
  countCompletedExercises,
  estimateLogTrainingMinutesForDisplay,
  formatDeltaLabel,
  formatTrainingDuration,
  topLoggedExercises,
  type HistoryPeriodWeeks,
} from "../app/memberTrainingHistory";
import { resolveProgramImageSrc, STRENGTH_TRAINING_COVER_IMAGE } from "../app/programImage";
import { resolveProgressPersonalRecordImage } from "../app/progressImagery";
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

const HISTORY_TABS: Array<{ id: HistoryTab; label: string }> = [
  { id: "oversikt", label: "Oversikt" },
  { id: "okter", label: "Økter" },
  { id: "ovelser", label: "Øvelser" },
  { id: "fremgang", label: "Fremgang" },
  { id: "kropp", label: "Kropp" },
];

const PERIOD_OPTIONS: Array<{ value: HistoryPeriodWeeks; label: string }> = [
  { value: 4, label: "Siste 4 uker" },
  { value: 12, label: "Siste 12 uker" },
  { value: 26, label: "Siste 26 uker" },
];

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
  const coverExercise = exercises.find((exercise) =>
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
  return parsed.toLocaleDateString("no-NO", { day: "numeric", month: "short", year: "numeric" });
}

function formatMinutesDelta(minutes: number): string {
  if (minutes === 0) return "0 min fra forrige periode";
  const sign = minutes > 0 ? "+" : "";
  return `${sign}${formatTrainingDuration(Math.abs(minutes))} fra forrige periode`;
}

function formatKcalDelta(kcal: number): string {
  if (kcal === 0) return "0 kcal fra forrige periode";
  const sign = kcal > 0 ? "+" : "";
  return `${sign}${Math.abs(kcal).toLocaleString("nb-NO")} kcal fra forrige periode`;
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
  const [activeTab, setActiveTab] = useState<HistoryTab>("oversikt");
  const [periodWeeks, setPeriodWeeks] = useState<HistoryPeriodWeeks>(12);

  const periodStats = useMemo(
    () => computeHistoryPeriodStats(completedLogs, periodWeeks, nowTimestamp),
    [completedLogs, periodWeeks, nowTimestamp],
  );
  const weeklyBars = useMemo(() => computeWeeklyWorkoutBars(completedLogs, 10, nowTimestamp), [completedLogs, nowTimestamp]);
  const previousWeeklyBars = useMemo(
    () => computeWeeklyWorkoutBars(completedLogs, 10, nowTimestamp - periodWeeks * 7 * 24 * 60 * 60 * 1000),
    [completedLogs, nowTimestamp, periodWeeks],
  );
  const weeklyInsight = useMemo(
    () => computeWeeklyAverageInsight(weeklyBars, previousWeeklyBars),
    [weeklyBars, previousWeeklyBars],
  );
  const heatmapMonths = useMemo(
    () => computeConsistencyHeatmap(completedLogs, 3, nowTimestamp),
    [completedLogs, nowTimestamp],
  );
  const topExercises = useMemo(() => topLoggedExercises(completedLogs, 12), [completedLogs]);
  const maxWeeklyCount = Math.max(1, ...weeklyBars.map((bar) => bar.count));
  const recentWorkoutCards = useMemo(
    () =>
      [...memberLogs]
        .sort((a, b) => (parseStoredLogDate(b.date)?.getTime() ?? 0) - (parseStoredLogDate(a.date)?.getTime() ?? 0))
        .slice(0, 5),
    [memberLogs],
  );
  const recordPreview = personalRecords.slice(0, 8);

  return (
    <div className="motus-member-history motus-fade-in-up">
      <header className="motus-member-history-header">
        <div className="flex items-start gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
            style={{ background: MOTUS.gradient }}
          >
            <History className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <h2 className="text-xl font-bold tracking-tight text-slate-950">Historikk</h2>
            <p className="mt-0.5 text-sm text-slate-600">Se utviklingen din over tid</p>
          </div>
        </div>
      </header>

      <div className="motus-member-history-tabs scrollbar-none" role="tablist" aria-label="Historikk-visninger">
        {HISTORY_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="motus-member-history-tab"
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "oversikt" ? (
        <div className="motus-member-history-stack">
          <section className="motus-member-history-card">
            <div className="motus-member-history-card-head">
              <h3 className="text-base font-bold text-slate-900">Din utvikling</h3>
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
            <div className="motus-member-history-kpi-grid">
              <article className="motus-member-history-kpi">
                <div className="motus-member-history-kpi-icon motus-member-history-kpi-icon--teal">
                  <Dumbbell className="h-4 w-4" aria-hidden />
                </div>
                <div className="motus-member-history-kpi-value">{periodStats.workouts}</div>
                <div className="motus-member-history-kpi-label">Økter</div>
                <div className={`motus-member-history-kpi-delta ${periodStats.workoutsDelta >= 0 ? "is-positive" : "is-neutral"}`}>
                  {formatDeltaLabel(periodStats.workoutsDelta, periodStats.workoutsDelta === 1 ? "økt" : "økter")}
                </div>
              </article>
              <article className="motus-member-history-kpi">
                <div className="motus-member-history-kpi-icon motus-member-history-kpi-icon--orange">
                  <Flame className="h-4 w-4" aria-hidden />
                </div>
                <div className="motus-member-history-kpi-value">{formatTrainingDuration(periodStats.trainingMinutes)}</div>
                <div className="motus-member-history-kpi-label">Treningstid</div>
                <div className={`motus-member-history-kpi-delta ${periodStats.trainingMinutesDelta >= 0 ? "is-positive" : "is-neutral"}`}>
                  {formatMinutesDelta(periodStats.trainingMinutesDelta)}
                </div>
              </article>
              <article className="motus-member-history-kpi">
                <div className="motus-member-history-kpi-icon motus-member-history-kpi-icon--amber">
                  <Zap className="h-4 w-4" aria-hidden />
                </div>
                <div className="motus-member-history-kpi-value">{periodStats.estimatedKcal.toLocaleString("nb-NO")}</div>
                <div className="motus-member-history-kpi-label">Kcal</div>
                <div className={`motus-member-history-kpi-delta ${periodStats.estimatedKcalDelta >= 0 ? "is-positive" : "is-neutral"}`}>
                  {formatKcalDelta(periodStats.estimatedKcalDelta)}
                </div>
              </article>
              <article className="motus-member-history-kpi">
                <div className="motus-member-history-kpi-icon motus-member-history-kpi-icon--violet">
                  <Trophy className="h-4 w-4" aria-hidden />
                </div>
                <div className="motus-member-history-kpi-value">{periodStats.personalRecords}</div>
                <div className="motus-member-history-kpi-label">Personlige rekorder</div>
                <div className={`motus-member-history-kpi-delta is-accent ${periodStats.personalRecordsDelta >= 0 ? "is-positive" : "is-neutral"}`}>
                  {formatDeltaLabel(periodStats.personalRecordsDelta, periodStats.personalRecordsDelta === 1 ? "rekord" : "rekorder")}
                </div>
              </article>
            </div>
          </section>

          <section className="motus-member-history-card">
            <div className="motus-member-history-card-head">
              <h3 className="text-base font-bold text-slate-900">Aktivitetsoversikt</h3>
              <span className="motus-member-history-chip">Økter per uke</span>
            </div>
            {weeklyBars.every((bar) => bar.count === 0) ? (
              <EmptyState
                icon="📊"
                title="Ingen aktivitet ennå"
                description="Fullfør en økt for å se ukentlig aktivitet her."
                className="mt-3 bg-slate-50/80"
              />
            ) : (
              <>
                <div className="motus-member-history-chart" role="img" aria-label="Søylediagram over økter per uke">
                  {weeklyBars.map((bar) => (
                    <div key={bar.weekKey} className="motus-member-history-chart-col">
                      <div
                        className="motus-member-history-chart-bar"
                        style={{ height: `${Math.max(8, (bar.count / maxWeeklyCount) * 100)}%` }}
                        title={`${bar.label}: ${bar.count} økter`}
                      />
                      <span className="motus-member-history-chart-label">{bar.label.replace("Uke ", "U")}</span>
                    </div>
                  ))}
                </div>
                {weeklyInsight ? <div className="motus-member-history-insight">{weeklyInsight}</div> : null}
              </>
            )}
          </section>

          <section className="motus-member-history-card">
            <div className="motus-member-history-card-head">
              <h3 className="text-base font-bold text-slate-900">Nylige økter</h3>
              <button type="button" onClick={() => setActiveTab("okter")} className="motus-member-history-link">
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
                  const exerciseCount = countCompletedExercises(log);
                  const minutes = estimateLogTrainingMinutesForDisplay(log);
                  return (
                    <button
                      key={log.id}
                      type="button"
                      onClick={() => {
                        setActiveTab("okter");
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
                        <div className="truncate text-sm font-semibold text-slate-900">{log.programTitle}</div>
                        <div className="mt-0.5 text-xs text-slate-500">
                          {exerciseCount} {exerciseCount === 1 ? "øvelse" : "øvelser"} · {minutes} min
                        </div>
                        <div className="mt-1 text-[11px] text-slate-400">{formatLogDateLabel(log.date)}</div>
                      </div>
                      <span className={`motus-member-history-status ${log.status === "Fullført" ? "is-done" : "is-planned"}`}>
                        {log.status}
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" aria-hidden />
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section className="motus-member-history-card">
            <div className="motus-member-history-card-head">
              <h3 className="text-base font-bold text-slate-900">Personlige rekorder</h3>
              <button type="button" onClick={() => setActiveTab("fremgang")} className="motus-member-history-link">
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
              <div className="motus-member-history-pr-scroll scrollbar-none">
                {recordPreview.map((record) => {
                  const imageSrc = resolveRecordImage(record.name, exercises);
                  return (
                    <button
                      key={record.name}
                      type="button"
                      onClick={() => onOpenProgressExercise(record.name)}
                      className="motus-member-history-pr-card motus-pressable"
                    >
                      <div className="motus-member-history-pr-image motus-image-frame">
                        <img
                          src={imageSrc}
                          alt=""
                          className="motus-image-media"
                          loading="lazy"
                          style={{ objectPosition: imageObjectPositionFromSrc(imageSrc) }}
                        />
                      </div>
                      <div className="mt-2 text-sm font-bold text-slate-900">{record.name}</div>
                      <div className="mt-0.5 text-xs font-semibold text-teal-700">
                        {record.weight} kg{record.reps ? ` · ${record.reps} reps` : ""}
                      </div>
                      {record.isNewRecord ? <div className="motus-member-history-pr-badge">Ny rekord!</div> : null}
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section className="motus-member-history-card">
            <div className="motus-member-history-card-head">
              <h3 className="text-base font-bold text-slate-900">Konsistens</h3>
              <span className="motus-member-history-chip">Siste 3 måneder</span>
            </div>
            <div className="motus-member-history-heatmap">
              {heatmapMonths.map((month) => (
                <div key={month.label} className="motus-member-history-heatmap-month">
                  <div className="motus-member-history-heatmap-label">{month.label}</div>
                  <div className="motus-member-history-heatmap-grid">
                    {month.cells.map((cell, index) =>
                      cell ? (
                        <span
                          key={cell.dateKey}
                          className={`motus-member-history-heatmap-cell level-${cell.level}`}
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
          </section>
        </div>
      ) : null}

      {activeTab === "okter" ? (
        <section className="motus-member-history-card">
          <div className="motus-member-history-card-head">
            <h3 className="text-base font-bold text-slate-900">Alle økter</h3>
            <span className="text-xs text-slate-500">{allLogsForSessions.length} loggførte økter</span>
          </div>
          <MemberWorkoutHistoryLogList logs={allLogsForSessions} focusLogId={focusLogId} {...logListProps} />
        </section>
      ) : null}

      {activeTab === "ovelser" ? (
        <section className="motus-member-history-card">
          <div className="motus-member-history-card-head">
            <h3 className="text-base font-bold text-slate-900">Mest loggede øvelser</h3>
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

      {activeTab === "fremgang" ? (
        <section className="motus-member-history-card">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">Din fremgang</h3>
              <p className="mt-1 text-sm text-slate-600">
                {streakWeeks > 0
                  ? `Du har ${streakWeeks} ${streakWeeks === 1 ? "uke" : "uker"} med jevn aktivitet.`
                  : "Bygg streak og rekorder ved å trene jevnlig."}
              </p>
              <p className="mt-2 text-xs text-slate-500">{personalRecords.length} personlige rekorder registrert</p>
            </div>
            <GradientButton type="button" onClick={onOpenProgress} className="w-full shrink-0 sm:w-auto">
              <Activity className="h-4 w-4" aria-hidden />
              Åpne fremgangssiden
            </GradientButton>
          </div>
          {recordPreview.length > 0 ? (
            <div className="motus-member-history-pr-scroll scrollbar-none mt-4">
              {personalRecords.slice(0, 12).map((record) => (
                <button
                  key={record.name}
                  type="button"
                  onClick={() => onOpenProgressExercise(record.name)}
                  className="motus-member-history-pr-card motus-pressable"
                >
                  <div className="text-sm font-bold text-slate-900">{record.name}</div>
                  <div className="mt-1 text-xs font-semibold text-teal-700">
                    {record.weight} kg × {record.reps}
                  </div>
                </button>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {activeTab === "kropp" ? (
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

export type { EditingLoggedExerciseDraft };
