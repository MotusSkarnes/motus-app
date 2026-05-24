import type { ReactNode } from "react";
import { ArrowRight, Calendar, Check, ChevronRight, Dumbbell, Share2, Trophy, Zap } from "lucide-react";
import type { MemberProgressState } from "../app/memberProgressGamification";
import type { MemberProgressScores } from "../app/memberMomentumScores";
import { PROGRESS_STEP_LABELS } from "../app/memberProgressGamification";
import {
  buildCurrentWeekDayDots,
  buildProgressHighlightLine,
  computeConsecutiveTrainingDays,
  computeLongestStreakWeeks,
} from "../app/memberProgressPageHelpers";
import { computeWeeklyWorkoutBars } from "../app/memberTrainingHistory";
import { PROGRESS_FLOW_IMAGE } from "../app/progressImagery";
import { imageObjectPositionFromSrc } from "../app/imageFocalPoint";
import type { Exercise, WorkoutLog } from "../app/types";
import { GradientButton, StatusMessage } from "../app/ui";
import { MemberProgressHeroCard } from "./MemberProgressHeroCard";
import { MemberPersonalRecordsSection, type PersonalRecordEntry } from "./MemberPersonalRecordsSection";
import { MuscleSplitCard } from "./MuscleSplitCard";
import type { MuscleGroupStat, MuscleSplitMetric, MuscleSplitPeriod } from "./muscleSplitStats";
import { MotusFlameIcon } from "./MotusFlameIcon";

type WeeklySummaryStats = {
  workouts: number;
  trainingDays: number;
  completedSets: number;
  volumeKg: number;
};

type MemberProgressPageViewProps = {
  scores: MemberProgressScores;
  memberProgress: MemberProgressState;
  streakWeeks: number;
  completedLogDates: Date[];
  completedLogs: WorkoutLog[];
  nowTimestamp: number;
  personalRecords: PersonalRecordEntry[];
  personalRecordsPreview: PersonalRecordEntry[];
  showAllPersonalRecords: boolean;
  onToggleShowAllPersonalRecords: () => void;
  favoritePersonalRecordNames: string[];
  onToggleFavoritePersonalRecord: (name: string) => void;
  onOpenProgressExercise: (name: string) => void;
  onSharePersonalRecord: (record: PersonalRecordEntry) => void;
  exercises: Exercise[];
  profileSaveInfo: string | null;
  muscleSplitStats: MuscleGroupStat[];
  muscleSplitMetric: MuscleSplitMetric;
  muscleSplitPeriod: MuscleSplitPeriod;
  onMuscleSplitMetricChange: (metric: MuscleSplitMetric) => void;
  onMuscleSplitPeriodChange: (period: MuscleSplitPeriod) => void;
  weeklySummaryStats: WeeklySummaryStats;
  onShareWeeklySummary: () => void;
  weeklyShareStatus: string | null;
  onContinueTrainingFlow: () => void;
};

function ProgressSectionCard({
  title,
  action,
  children,
  className = "",
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`motus-progress-v2-section ${className}`.trim()}>
      <div className="motus-progress-v2-section-head">
        <h3 className="motus-progress-v2-section-title">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function ProgressStatusBanner({ line, onOpenDetails }: { line: string; onOpenDetails?: () => void }) {
  return (
    <div className="motus-progress-v2-status-banner">
      <span className="motus-progress-v2-status-banner-icon" aria-hidden>
        <Trophy className="h-4 w-4" strokeWidth={2.25} />
      </span>
      <p className="motus-progress-v2-status-banner-text">{line}</p>
      {onOpenDetails ? (
        <button type="button" onClick={onOpenDetails} className="motus-progress-v2-status-banner-link motus-pressable">
          Se detaljer
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

function ProgressConsistencySection({
  weekDots,
  streakWeeks,
  bestStreakWeeks,
  prEncouragement,
}: {
  weekDots: ReturnType<typeof buildCurrentWeekDayDots>;
  streakWeeks: number;
  bestStreakWeeks: number;
  prEncouragement: string | null;
}) {
  return (
    <ProgressSectionCard
      title="Konsistens"
      action={
        <span className="motus-progress-v2-section-link">
          Siste 8 uker
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </span>
      }
    >
      <div className="motus-progress-v2-week-dots" aria-label="Denne uken">
        {weekDots.map((day) => (
          <div key={day.key} className="motus-progress-v2-week-dot-col">
            <span
              className={`motus-progress-v2-week-dot ${
                day.trained
                  ? "is-trained"
                  : day.isFuture
                    ? "is-future"
                    : day.isToday
                      ? "is-today"
                      : "is-empty"
              }`}
              aria-hidden
            >
              {day.trained ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
            </span>
            <span className="motus-progress-v2-week-dot-label">{day.label}</span>
          </div>
        ))}
      </div>

      <div className="motus-progress-v2-consistency-cards">
        <article className="motus-progress-v2-consistency-card">
          <span className="motus-progress-v2-consistency-card-icon motus-progress-v2-consistency-card-icon--pink" aria-hidden>
            <MotusFlameIcon className="h-4 w-4" title="" />
          </span>
          <div>
            <p className="motus-progress-v2-consistency-card-value">
              {streakWeeks > 0 ? `${streakWeeks} ${streakWeeks === 1 ? "uke" : "ukers"} streak` : "Ingen streak ennå"}
            </p>
            <p className="motus-progress-v2-consistency-card-sub">
              {bestStreakWeeks > 0 ? `Din beste: ${bestStreakWeeks} ${bestStreakWeeks === 1 ? "uke" : "uker"}` : "Logg én økt for å starte"}
            </p>
          </div>
        </article>
        {prEncouragement ? (
          <article className="motus-progress-v2-consistency-card">
            <span className="motus-progress-v2-consistency-card-emoji" aria-hidden>
              🎉
            </span>
            <p className="motus-progress-v2-consistency-card-message">{prEncouragement}</p>
          </article>
        ) : null}
      </div>
    </ProgressSectionCard>
  );
}

function ProgressNextSessionCard({
  stepLabel,
  nextStepLabel,
  activeStep,
  hasCompletedAllLevels,
  onContinue,
}: {
  stepLabel: string;
  nextStepLabel: string | null;
  activeStep: number;
  hasCompletedAllLevels: boolean;
  onContinue: () => void;
}) {
  const activeStepLabel = PROGRESS_STEP_LABELS[activeStep - 1] ?? stepLabel;

  return (
    <section className="motus-progress-v2-next-session" aria-labelledby="progress-next-session-title">
      <img
        src={PROGRESS_FLOW_IMAGE}
        alt=""
        className="motus-progress-v2-next-session-bg"
        loading="lazy"
        style={{ objectPosition: imageObjectPositionFromSrc(PROGRESS_FLOW_IMAGE) }}
      />
      <div className="motus-progress-v2-next-session-overlay" aria-hidden />
      <div className="motus-progress-v2-next-session-content">
        <span className="motus-progress-v2-next-session-badge">Din neste økt</span>
        <h3 id="progress-next-session-title" className="motus-progress-v2-next-session-title">
          {hasCompletedAllLevels ? "Hold vanen levende" : activeStepLabel}
        </h3>
        <p className="motus-progress-v2-next-session-sub">
          {hasCompletedAllLevels
            ? "Du har fullført alle steg — fortsett jevnt."
            : nextStepLabel
              ? `Det er på «${stepLabel}». Neste: «${nextStepLabel}».`
              : `Du er på «${stepLabel}».`}
        </p>
        {!hasCompletedAllLevels ? (
          <GradientButton type="button" onClick={onContinue} className="motus-progress-v2-next-session-cta gap-2">
            Fortsett steg {activeStep}
            <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
          </GradientButton>
        ) : null}
      </div>
    </section>
  );
}

function ProgressWeeklySummarySection({
  stats,
  onShare,
  shareStatus,
}: {
  stats: WeeklySummaryStats;
  onShare: () => void;
  shareStatus: string | null;
}) {
  const cells = [
    { label: "Økter", value: String(stats.workouts), icon: Calendar, tone: "teal" as const },
    { label: "Treningsdager", value: String(stats.trainingDays), icon: Zap, tone: "pink" as const },
    { label: "Sett", value: String(stats.completedSets), icon: Dumbbell, tone: "teal" as const },
    {
      label: "Totalt løftet",
      value: `${Math.round(stats.volumeKg).toLocaleString("nb-NO")} kg`,
      icon: MotusFlameIcon,
      tone: "pink" as const,
    },
  ];

  return (
    <ProgressSectionCard
      title="Ukesoppsummering"
      action={
        <span className="motus-progress-v2-section-link">
          Se detaljert
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </span>
      }
    >
      <div className="motus-progress-v2-weekly-grid">
        {cells.map((cell) => {
          const Icon = cell.icon;
          return (
            <div key={cell.label} className="motus-progress-v2-weekly-stat">
              <span className={`motus-progress-v2-weekly-stat-icon motus-progress-v2-weekly-stat-icon--${cell.tone}`} aria-hidden>
                <Icon className="h-4 w-4" strokeWidth={2.25} />
              </span>
              <div className="motus-progress-v2-weekly-stat-value">{cell.value}</div>
              <div className="motus-progress-v2-weekly-stat-label">{cell.label.toUpperCase()}</div>
            </div>
          );
        })}
      </div>
      <GradientButton type="button" onClick={onShare} className="motus-progress-v2-weekly-share gap-2">
        <Share2 className="h-4 w-4 shrink-0" aria-hidden />
        Last ned eller del bilde
      </GradientButton>
      {shareStatus ? (
        <StatusMessage
          message={shareStatus}
          tone={shareStatus.toLowerCase().includes("kunne ikke") ? "error" : "success"}
          className="mt-3 !rounded-xl !px-3 !py-2 !text-xs"
        />
      ) : null}
    </ProgressSectionCard>
  );
}

export function MemberProgressPageView({
  scores,
  memberProgress,
  streakWeeks,
  completedLogDates,
  completedLogs,
  nowTimestamp,
  personalRecords,
  personalRecordsPreview,
  showAllPersonalRecords,
  onToggleShowAllPersonalRecords,
  favoritePersonalRecordNames,
  onToggleFavoritePersonalRecord,
  onOpenProgressExercise,
  onSharePersonalRecord,
  exercises,
  profileSaveInfo,
  muscleSplitStats,
  muscleSplitMetric,
  muscleSplitPeriod,
  onMuscleSplitMetricChange,
  onMuscleSplitPeriodChange,
  weeklySummaryStats,
  onShareWeeklySummary,
  weeklyShareStatus,
  onContinueTrainingFlow,
}: MemberProgressPageViewProps) {
  const now = new Date(nowTimestamp);
  const weekDots = buildCurrentWeekDayDots(completedLogDates, now);
  const consecutiveDays = computeConsecutiveTrainingDays(completedLogDates, now);
  const bestStreakWeeks = computeLongestStreakWeeks(completedLogDates);
  const weeklyBars = computeWeeklyWorkoutBars(completedLogs, now);
  const highlightLine = buildProgressHighlightLine(
    weeklySummaryStats.workouts,
    weeklyBars.map((bar) => bar.count),
  );
  const newRecordCount = personalRecords.filter((record) => record.isNewRecord).length;
  const prEncouragement =
    newRecordCount > 0
      ? `${newRecordCount} ny${newRecordCount === 1 ? "" : "e"} personlig${newRecordCount === 1 ? "" : "e"} rekord${newRecordCount === 1 ? "" : "er"}!`
      : personalRecords.length > 0
        ? "Logg styrke for å jage nye rekorder."
        : null;
  const activeStep = memberProgress.workingLevel;

  return (
    <div className="motus-progress-page motus-progress-page--v2">
      <MemberProgressHeroCard
        scores={scores}
        consecutiveTrainingDays={consecutiveDays}
        streakWeeks={streakWeeks}
      />

      {highlightLine ? <ProgressStatusBanner line={highlightLine} /> : null}

      <ProgressConsistencySection
        weekDots={weekDots}
        streakWeeks={streakWeeks}
        bestStreakWeeks={bestStreakWeeks}
        prEncouragement={prEncouragement}
      />

      <ProgressNextSessionCard
        stepLabel={memberProgress.stepLabel}
        nextStepLabel={memberProgress.nextStepLabel}
        activeStep={activeStep}
        hasCompletedAllLevels={memberProgress.hasCompletedAllLevels}
        onContinue={onContinueTrainingFlow}
      />

      <MemberPersonalRecordsSection
        records={personalRecords}
        previewRecords={personalRecordsPreview}
        showAll={showAllPersonalRecords}
        onToggleShowAll={onToggleShowAllPersonalRecords}
        favoriteNames={favoritePersonalRecordNames}
        onToggleFavorite={onToggleFavoritePersonalRecord}
        onOpenProgress={onOpenProgressExercise}
        onShare={onSharePersonalRecord}
        exercises={exercises}
        profileSaveInfo={profileSaveInfo}
        variant="v2"
      />

      <MuscleSplitCard
        stats={muscleSplitStats}
        metric={muscleSplitMetric}
        period={muscleSplitPeriod}
        onMetricChange={onMuscleSplitMetricChange}
        onPeriodChange={onMuscleSplitPeriodChange}
        variant="v2"
      />

      <ProgressWeeklySummarySection stats={weeklySummaryStats} onShare={onShareWeeklySummary} shareStatus={weeklyShareStatus} />
    </div>
  );
}
