import { useMemo, useState } from "react";
import {
  Activity,
  CalendarRange,
  Dumbbell,
  Flame,
  Target,
  TrendingDown,
  TrendingUp,
  Trophy,
} from "lucide-react";
import { MOTUS } from "../app/data";
import { resolveProgressExerciseDisplayName } from "../app/progressImagery";
import type { HistoryPeriodWeeks } from "../app/memberTrainingHistory";
import { buildComebackStreakMessage } from "../app/memberProgressGamification";
import { buildTrainerMemberProgressSnapshot } from "../app/trainerMemberProgress";
import type { Exercise, WorkoutLog } from "../app/types";
import { EmptyState } from "../app/ui";
import { PersonalRecordProgressModal } from "./PersonalRecordProgressModal";

const PERIOD_OPTIONS: Array<{ value: HistoryPeriodWeeks; label: string }> = [
  { value: 4, label: "Siste 4 uker" },
  { value: 12, label: "Siste 12 uker" },
  { value: 26, label: "Siste 26 uker" },
];

const HEATMAP_WEEKDAYS = ["M", "T", "O", "T", "F", "L", "S"] as const;

type TrainerMemberProgressViewProps = {
  memberName: string;
  logs: WorkoutLog[];
  exercises: Exercise[];
  nowTimestamp?: number;
};

function formatDelta(value: number): string {
  if (value === 0) return "0";
  return `${value > 0 ? "+" : ""}${value}`;
}

function MiniSparkline({ values }: { values: number[] }) {
  if (values.length < 2) return <span className="motus-trainer-progress-spark is-empty">—</span>;
  const width = 84;
  const height = 28;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);
  const points = values.map((value, index) => {
    const x = (index / (values.length - 1)) * width;
    const y = height - ((value - min) / span) * (height - 4) - 2;
    return `${x},${y}`;
  });
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="motus-trainer-progress-spark" aria-hidden>
      <polyline
        fill="none"
        stroke={MOTUS.turquoise}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points.join(" ")}
      />
    </svg>
  );
}

export function TrainerMemberProgressView({
  memberName,
  logs,
  exercises,
  nowTimestamp = Date.now(),
}: TrainerMemberProgressViewProps) {
  const [periodWeeks, setPeriodWeeks] = useState<HistoryPeriodWeeks>(12);
  const [openExerciseName, setOpenExerciseName] = useState<string | null>(null);
  const snapshot = useMemo(
    () => buildTrainerMemberProgressSnapshot({ logs, exercises, periodWeeks, nowTimestamp }),
    [logs, exercises, periodWeeks, nowTimestamp],
  );
  const maxWeekly = Math.max(1, ...snapshot.weeklyBars.map((bar) => bar.count));
  const openLift = snapshot.strengthLifts.find((lift) => lift.name === openExerciseName) ?? null;
  const firstName = memberName.trim().split(/\s+/)[0] || "kunden";
  const hasCompletedWorkouts = logs.some((log) => log.status === "Fullført");

  return (
    <div className="motus-member-history motus-trainer-progress motus-fade-in-up">
      <section className="motus-member-history-card">
        <div className="motus-member-history-card-head">
          <div>
            <h3 className="motus-member-history-section-title">Oppsummering</h3>
            <p className="mt-0.5 text-xs text-slate-500">Utvikling for {firstName} basert på fullførte økter.</p>
          </div>
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
              <CalendarRange className="h-3.5 w-3.5" aria-hidden />
            </div>
            <div className="motus-member-history-kpi-main">
              <span className="motus-member-history-kpi-value">{snapshot.averageSessionsPerWeek.toLocaleString("nb-NO")}</span>
              <span className="motus-member-history-kpi-label">Økter / uke</span>
            </div>
            <div className={`motus-member-history-kpi-delta is-teal ${snapshot.averageSessionsPerWeek >= snapshot.previousAverageSessionsPerWeek ? "is-positive" : ""}`}>
              {formatDelta(
                Math.round((snapshot.averageSessionsPerWeek - snapshot.previousAverageSessionsPerWeek) * 10) / 10,
              )}
            </div>
          </article>
          <article className="motus-member-history-kpi-card">
            <div className="motus-member-history-kpi-icon motus-member-history-kpi-icon--pink">
              <Target className="h-3.5 w-3.5" aria-hidden />
            </div>
            <div className="motus-member-history-kpi-main">
              <span className="motus-member-history-kpi-value">{snapshot.periodStats.workouts}</span>
              <span className="motus-member-history-kpi-label">Økter i perioden</span>
            </div>
            <div className={`motus-member-history-kpi-delta is-pink ${snapshot.periodStats.workoutsDelta >= 0 ? "is-positive" : ""}`}>
              {formatDelta(snapshot.periodStats.workoutsDelta)}
            </div>
          </article>
          <article className="motus-member-history-kpi-card">
            <div className="motus-member-history-kpi-icon motus-member-history-kpi-icon--violet">
              <Activity className="h-3.5 w-3.5" aria-hidden />
            </div>
            <div className="motus-member-history-kpi-main">
              <span className="motus-member-history-kpi-value">{snapshot.trainingTimeLabel}</span>
              <span className="motus-member-history-kpi-label">Treningstid</span>
            </div>
          </article>
          <article className="motus-member-history-kpi-card">
            <div className="motus-member-history-kpi-icon motus-member-history-kpi-icon--amber">
              <Trophy className="h-3.5 w-3.5" aria-hidden />
            </div>
            <div className="motus-member-history-kpi-main">
              <span className="motus-member-history-kpi-value">{snapshot.periodStats.personalRecords}</span>
              <span className="motus-member-history-kpi-label">Nye rekorder</span>
            </div>
            <div className={`motus-member-history-kpi-delta is-pink ${snapshot.periodStats.personalRecordsDelta >= 0 ? "is-positive" : ""}`}>
              {formatDelta(snapshot.periodStats.personalRecordsDelta)}
            </div>
          </article>
        </div>
      </section>

      <section className="motus-member-history-card">
        <div className="motus-member-history-card-head">
          <h3 className="motus-member-history-section-title">Økter per uke</h3>
          <span className="motus-member-history-chip">
            {snapshot.streakWeeks > 0 ? `${snapshot.streakWeeks} ukers streak` : "Ingen streak"}
          </span>
        </div>
        {snapshot.weeklyBars.every((bar) => bar.count === 0) ? (
          <EmptyState
            icon="📅"
            title="Ingen fullførte økter i perioden"
            description="Når kunden logger økter, vises ukesfrekvens her."
            className="mt-3 bg-slate-50/80"
          />
        ) : (
          <>
            <div className="motus-member-history-chart" role="img" aria-label="Økter per uke">
              {snapshot.weeklyBars.map((bar) => (
                <div key={bar.weekKey} className="motus-member-history-chart-col">
                  <span className="motus-trainer-progress-bar-value">{bar.count}</span>
                  <div
                    className="motus-member-history-chart-bar"
                    style={{ height: `${bar.count === 0 ? 6 : Math.max(10, Math.round((bar.count / maxWeekly) * 88))}px` }}
                  />
                  <span className="motus-member-history-chart-label">{bar.label.replace("Uke ", "U")}</span>
                </div>
              ))}
            </div>
            {snapshot.weeklyInsight ? (
              <p className="motus-member-history-insight mt-3">{snapshot.weeklyInsight}</p>
            ) : null}
          </>
        )}
      </section>

      <section className="motus-member-history-card">
        <div className="motus-member-history-card-head">
          <h3 className="motus-member-history-section-title">Styrkeutvikling</h3>
          <span className="motus-member-history-chip">Est. 1RM / beste sett</span>
        </div>
        {snapshot.strengthLifts.length === 0 ? (
          <EmptyState
            icon="🏋️"
            title="Ingen styrkedata ennå"
            description="Når kunden logger vekt og reps, vises utvikling per øvelse her."
            className="mt-3 bg-slate-50/80"
          />
        ) : (
          <ul className="motus-trainer-progress-lifts">
            {snapshot.strengthLifts.map((lift) => {
              const TrendIcon = (lift.deltaValue ?? 0) >= 0 ? TrendingUp : TrendingDown;
              return (
                <li key={lift.name}>
                  <button
                    type="button"
                    className="motus-trainer-progress-lift motus-pressable"
                    onClick={() => setOpenExerciseName(lift.name)}
                  >
                    <span className="motus-trainer-progress-lift-icon" aria-hidden>
                      <Dumbbell className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1 text-left">
                      <span className="motus-trainer-progress-lift-name">
                        {resolveProgressExerciseDisplayName(lift.name)}
                      </span>
                      <span className="motus-trainer-progress-lift-meta">
                        {lift.currentLabel} · {lift.sessions} {lift.sessions === 1 ? "økt" : "økter"}
                      </span>
                    </span>
                    <MiniSparkline values={lift.history.map((point) => point.estimated1RmKg)} />
                    <span
                      className={`motus-trainer-progress-lift-delta ${
                        (lift.deltaValue ?? 0) > 0 ? "is-up" : (lift.deltaValue ?? 0) < 0 ? "is-down" : ""
                      }`}
                    >
                      <TrendIcon className="h-3.5 w-3.5" aria-hidden />
                      {lift.deltaLabel}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="motus-member-history-card">
        <div className="motus-member-history-card-head">
          <h3 className="motus-member-history-section-title">Kontinuitet</h3>
          <span className="motus-member-history-chip">Siste 4 måneder</span>
        </div>
        {snapshot.streakWeeks > 0 ? (
          <div className="motus-member-history-consistency-banner">
            <span className="motus-member-history-consistency-banner-icon" aria-hidden>
              <Flame className="h-5 w-5" strokeWidth={2.25} />
            </span>
            <p className="motus-member-history-consistency-banner-text">
              {firstName} har streak på {snapshot.streakWeeks} {snapshot.streakWeeks === 1 ? "uke" : "uker"}.
            </p>
          </div>
        ) : hasCompletedWorkouts ? (
          <div className="motus-member-history-consistency-banner">
            <span className="motus-member-history-consistency-banner-icon" aria-hidden>
              <Flame className="h-5 w-5" strokeWidth={2.25} />
            </span>
            <p className="motus-member-history-consistency-banner-text">
              {buildComebackStreakMessage("trainer", firstName)}
            </p>
          </div>
        ) : null}
        <div className="motus-member-history-heatmap">
          {[...snapshot.heatmapMonths].reverse().map((month) => (
            <div key={month.label} className="motus-member-history-heatmap-month">
              <div className="motus-member-history-heatmap-label">{month.label}</div>
              <div className="motus-member-history-heatmap-weekdays-row" aria-hidden>
                {HEATMAP_WEEKDAYS.map((day, index) => (
                  <span key={`${month.label}-${day}-${index}`}>{day}</span>
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
          <span>Færre</span>
          <span className="motus-member-history-heatmap-cell level-0" />
          <span className="motus-member-history-heatmap-cell level-1" />
          <span className="motus-member-history-heatmap-cell level-2" />
          <span className="motus-member-history-heatmap-cell level-3" />
          <span className="motus-member-history-heatmap-cell level-4" />
          <span>Flere</span>
        </div>
      </section>

      {openLift ? (
        <PersonalRecordProgressModal
          exerciseName={openLift.name}
          recordKind={openLift.kind}
          logs={logs}
          memberDisplayName={memberName}
          onClose={() => setOpenExerciseName(null)}
        />
      ) : null}
    </div>
  );
}
