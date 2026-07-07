import type { CSSProperties, ReactNode } from "react";
import {
  Bookmark,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Dumbbell,
  Flame,
  Play,
  ShieldCheck,
  X,
} from "lucide-react";
import { MOTUS } from "../app/data";
import { imageObjectPositionFromSrc } from "../app/imageFocalPoint";
import { formatStopGoalWithoutLabel, type MemberStopGoal } from "../app/memberStopGoal";
import { GradientButton, OutlineButton, TrainingStartButton } from "../app/ui";

export type MemberHomeStatusCard = {
  title: string;
  detail: string;
  onClick?: () => void;
};

export type MemberHomeWeekStats = {
  completedSessions: number;
  momentumPct: number;
  streakWeeks: number;
};

export type MemberHomeStopGoal = MemberStopGoal & {
  label: string;
  days: number;
};

export type MemberHomeOverviewProps = {
  memberFirstName: string;
  todayDateLabel: string;
  headerMotivation?: string | null;
  memberAvatarUrl?: string | null;
  onOpenProfile?: () => void;
  streakWeeks: number;
  dashboardHeadline: string;
  dashboardSubline?: string | null;
  dashboardProgressPct?: number;
  momentumPct: number;
  stopGoals?: MemberHomeStopGoal[];
  weekSessionsLabel?: string | null;
  weekMinutesLabel?: string | null;
  workoutTitle: string;
  workoutTitleLoading?: boolean;
  workoutSubtitle?: string | null;
  workoutDuration: string | null;
  workoutImageSrc?: string | null;
  workoutCoverImageStyle?: CSSProperties;
  workoutCoverUsesPhotoStyle?: boolean;
  workoutZoneLabel?: string | null;
  weekStats?: MemberHomeWeekStats | null;
  betweenSections?: ReactNode;
  headerActions?: ReactNode;
  notificationsPanel?: ReactNode;
  primaryCta: ReactNode;
  onWorkoutCardClick?: () => void;
  belowWorkout?: ReactNode;
  onboardingPrompt?: ReactNode;
  monthlyCheckInPrompt?: ReactNode;
  bottomContent?: ReactNode;
};

export function MemberHomeOverview({
  memberFirstName,
  todayDateLabel,
  headerMotivation,
  memberAvatarUrl,
  onOpenProfile,
  streakWeeks,
  dashboardHeadline,
  dashboardSubline,
  dashboardProgressPct,
  momentumPct,
  stopGoals = [],
  weekSessionsLabel,
  weekMinutesLabel,
  workoutTitle,
  workoutTitleLoading = false,
  workoutSubtitle,
  workoutDuration,
  workoutImageSrc,
  workoutCoverImageStyle,
  workoutCoverUsesPhotoStyle = false,
  workoutZoneLabel,
  primaryCta,
  onWorkoutCardClick,
  belowWorkout,
  onboardingPrompt,
  monthlyCheckInPrompt,
  bottomContent,
}: MemberHomeOverviewProps) {
  const streakLabel = streakWeeks > 0 ? `${streakWeeks} ${streakWeeks === 1 ? "uke" : "uker"}` : "0 uker";
  const headerLine = headerMotivation?.trim() || todayDateLabel;
  const visibleStopGoals = stopGoals
    .map((goal) => ({ ...goal, withoutLabel: formatStopGoalWithoutLabel(goal.label) }))
    .filter((goal) => goal.withoutLabel);

  return (
    <div className="motus-home motus-fade-in-up">
      <header className="px-0.5 pt-0.5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onOpenProfile?.()}
            disabled={!onOpenProfile}
            className="motus-pressable relative h-11 w-11 shrink-0 overflow-hidden rounded-full ring-2 ring-white shadow-[0_2px_10px_-4px_rgba(15,23,42,0.25)] disabled:cursor-default"
            aria-label="Åpne profil"
          >
            <span
              className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-white"
              style={{ background: `${MOTUS.gradient}` }}
            >
              {memberFirstName.charAt(0).toUpperCase()}
            </span>
            {memberAvatarUrl ? (
              <img
                src={memberAvatarUrl}
                alt=""
                className="relative z-10 h-full w-full object-cover"
                loading="lazy"
                onError={(event) => {
                  event.currentTarget.style.display = "none";
                }}
              />
            ) : null}
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-[1.25rem] font-semibold leading-tight tracking-tight text-slate-900">
              Hei, {memberFirstName}!
            </h1>
            <p className="mt-0.5 text-sm text-slate-500">{headerLine}</p>
          </div>
        </div>
      </header>

      <article className="motus-home-workout-card motus-home-workout-card--stacked">
        <div className="motus-home-workout-media">
          <div className="motus-member-program-thumb motus-image-frame">
            {workoutImageSrc ? (
              <img
                className={`motus-member-program-cover motus-image-media${
                  workoutCoverUsesPhotoStyle
                    ? " motus-member-program-cover--custom"
                    : " motus-member-program-cover--exercise"
                }`}
                src={workoutImageSrc}
                alt=""
                loading="lazy"
                style={
                  workoutCoverImageStyle ?? { objectPosition: imageObjectPositionFromSrc(workoutImageSrc) }
                }
              />
            ) : (
              <div className="motus-member-program-thumb-fallback" aria-hidden>
                <Dumbbell className="h-10 w-10 text-slate-400" strokeWidth={1.5} />
              </div>
            )}
          </div>

          {onWorkoutCardClick ? (
            <button
              type="button"
              onClick={onWorkoutCardClick}
              className="motus-home-workout-top-action motus-pressable"
              aria-label="Se trening"
              title="Se trening"
            >
              <Bookmark className="h-5 w-5" aria-hidden />
            </button>
          ) : null}
        </div>

        <div className="motus-home-workout-content">
          <div className="min-w-0 w-full">
            <p className="motus-home-workout-label">Dagens økt</p>
            <h2 className={`motus-home-workout-title ${workoutTitleLoading ? "animate-pulse text-slate-400" : ""}`}>
              {workoutTitleLoading ? "Henter dagens plan…" : workoutTitle || "Ingen plan i dag"}
            </h2>
            <div className="motus-home-workout-meta">
              {workoutDuration ? (
                <span className="inline-flex items-center gap-1.5">
                  <Clock3 className="h-3.5 w-3.5" aria-hidden />
                  {workoutDuration}
                </span>
              ) : null}
              {workoutZoneLabel ? (
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden>·</span>
                  {workoutZoneLabel}
                </span>
              ) : null}
            </div>
          </div>
          {workoutSubtitle ? <p className="motus-home-workout-subtitle">{workoutSubtitle}</p> : null}
          {primaryCta ? <div className="motus-home-workout-cta">{primaryCta}</div> : null}
        </div>
      </article>

      <section className="motus-home-dashboard" aria-label="Din fremgang">
        <div className="flex gap-4">
          <div className="motus-home-streak-ring shrink-0" aria-hidden>
            <svg viewBox="0 0 88 88" className="h-[5.75rem] w-[5.75rem]">
              <circle cx="44" cy="44" r="36" fill="none" stroke="rgba(48,227,190,0.16)" strokeWidth="6" />
              <circle
                cx="44"
                cy="44"
                r="36"
                fill="none"
                stroke={MOTUS.turquoise}
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={`${Math.max(12, Math.min(226, (momentumPct / 100) * 226))} 226`}
                transform="rotate(-90 44 44)"
              />
            </svg>
            <div className="motus-home-streak-ring-center">
              <span className="motus-home-streak-ring-fill">
                <Flame className="h-7 w-7" strokeWidth={2.25} aria-hidden />
              </span>
              <span className="sr-only">
                {streakWeeks} {streakWeeks === 1 ? "uke" : "uker"} streak
              </span>
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-[1.0625rem] font-semibold leading-snug text-slate-900">{dashboardHeadline}</h2>
            {dashboardSubline ? <p className="mt-1 text-sm leading-relaxed text-slate-600">{dashboardSubline}</p> : null}
            <div className="motus-progress-track mt-3 h-1 rounded-full">
              <div
                className="motus-progress-fill h-1 rounded-full"
                style={{
                  width: `${Math.max(0, Math.min(100, dashboardProgressPct ?? momentumPct))}%`,
                  background: `linear-gradient(90deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)`,
                }}
              />
            </div>
          </div>
        </div>
        <div className="motus-home-dash-kpi-row">
          <div className="motus-home-dash-kpi">
            <span className="motus-home-dash-kpi-icon motus-home-dash-kpi-icon--brand" aria-hidden>
              <CheckCircle2 className="h-4 w-4" strokeWidth={2.5} />
            </span>
            <span className="motus-home-dash-kpi-value">{weekSessionsLabel ?? "0/0"}</span>
            <span className="motus-home-dash-kpi-label">økter denne uka</span>
          </div>
          <div className="motus-home-dash-kpi">
            <span className="motus-home-dash-kpi-icon motus-home-dash-kpi-icon--time" aria-hidden>
              <Clock3 className="h-4 w-4" strokeWidth={2.35} />
            </span>
            <span className="motus-home-dash-kpi-value">{weekMinutesLabel ?? "0 min"}</span>
            <span className="motus-home-dash-kpi-label">trening</span>
          </div>
          <div className="motus-home-dash-kpi">
            <span className="motus-home-dash-kpi-icon motus-home-dash-kpi-icon--pink" aria-hidden>
              <Flame className="h-4 w-4" strokeWidth={2.35} />
            </span>
            <span className="motus-home-dash-kpi-value">{streakLabel}</span>
            <span className="motus-home-dash-kpi-label">på rad</span>
          </div>
        </div>
      </section>

      {visibleStopGoals.length ? (
        <section className="motus-home-stop-carousel" aria-label="Stopp">
          <div className="motus-home-stop-carousel__track" tabIndex={0}>
            {visibleStopGoals.map((goal, index) => {
              const days = Math.max(0, Number(goal.days ?? 0));
              return (
                <article
                  key={`${goal.withoutLabel}-${goal.startedAt}-${index}`}
                  className="motus-home-stop-card"
                  aria-label={`${days} døgn uten ${goal.withoutLabel}`}
                >
                  <div className="motus-home-stop-card__icon" aria-hidden>
                    <ShieldCheck className="h-5 w-5" strokeWidth={2.3} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="motus-home-stop-card__label">Stopp</p>
                    <p className="motus-home-stop-card__value">
                      {days} døgn uten {goal.withoutLabel}
                    </p>
                  </div>
                  <div className="motus-home-stop-card__spark" aria-hidden />
                </article>
              );
            })}
          </div>
          {visibleStopGoals.length > 1 ? (
            <div className="motus-home-stop-carousel__dots" aria-hidden>
              {visibleStopGoals.map((goal, index) => (
                <span key={`${goal.withoutLabel}-${index}`} />
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {belowWorkout}
      {onboardingPrompt ? <div className="w-full">{onboardingPrompt}</div> : null}
      {monthlyCheckInPrompt ? <div className="w-full">{monthlyCheckInPrompt}</div> : null}

      {bottomContent}
    </div>
  );
}

function HomeStatusRow({ statusCard }: { statusCard: MemberHomeStatusCard }) {
  const inner = (
    <>
      <p className="text-xs font-medium text-slate-600">{statusCard.title}</p>
      <p className="text-xs text-slate-500">{statusCard.detail}</p>
    </>
  );

  if (statusCard.onClick) {
    return (
      <button
        type="button"
        onClick={statusCard.onClick}
        className="motus-pressable group flex w-full items-center justify-between gap-3 rounded-2xl border border-white/60 bg-white/70 px-3.5 py-2.5 text-left shadow-[0_2px_12px_-8px_rgba(15,23,42,0.18)] backdrop-blur-sm transition hover:bg-white/90"
      >
        <span className="min-w-0 space-y-0.5">{inner}</span>
        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400 transition group-hover:text-slate-600" aria-hidden />
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-white/60 bg-white/70 px-3.5 py-2.5 shadow-[0_2px_12px_-8px_rgba(15,23,42,0.18)] backdrop-blur-sm">
      {inner}
    </div>
  );
}

export function MemberHomeCompactPrompt({
  title,
  detail,
  ctaLabel,
  onCta,
  onDismiss,
  dismissLabel = "Skjul",
}: {
  title: string;
  detail: string;
  ctaLabel: string;
  onCta: () => void;
  onDismiss?: () => void;
  dismissLabel?: string;
}) {
  return (
    <div className="relative flex flex-col gap-2.5 rounded-2xl border border-white/70 bg-white/80 px-4 py-3.5 pr-10 shadow-[0_2px_16px_-10px_rgba(15,23,42,0.14)] backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between sm:pr-10">
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-800">{title}</p>
        <p className="mt-0.5 text-xs text-slate-500">{detail}</p>
      </div>
      <GradientButton type="button" onClick={onCta} className="h-10 w-full shrink-0 rounded-xl px-4 text-xs font-semibold sm:w-auto">
        {ctaLabel}
      </GradientButton>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label={dismissLabel}
          title={dismissLabel}
          className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

export function MemberHomeStartWorkoutButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <TrainingStartButton type="button" onClick={onClick} className="motus-home-start-btn w-full">
      <Play className="h-3.5 w-3.5 fill-white text-white" aria-hidden />
      {label}
    </TrainingStartButton>
  );
}

export function MemberHomeSecondaryLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <OutlineButton
      type="button"
      onClick={onClick}
      className="motus-pressable h-11 w-full rounded-2xl border-slate-200/70 bg-white/90 px-5 text-sm font-medium text-slate-600 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:w-auto"
    >
      {label}
    </OutlineButton>
  );
}
