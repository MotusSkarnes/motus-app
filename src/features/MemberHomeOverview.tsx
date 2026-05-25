import type { ReactNode } from "react";
import {
  Bookmark,
  CalendarDays,
  CalendarRange,
  ChevronRight,
  ClipboardList,
  Clock3,
  Dumbbell,
  Flame,
  MessageSquare,
  Play,
} from "lucide-react";
import { MOTUS } from "../app/data";
import { imageObjectPositionFromSrc } from "../app/imageFocalPoint";
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

export type MemberHomeQuickActions = {
  onLogWorkout: () => void;
  onViewPrograms: () => void;
  onViewPeriodPlan: () => void;
  onViewMessages: () => void;
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
  momentumPct: number;
  weekSessionsLabel?: string | null;
  weekMinutesLabel?: string | null;
  workoutTitle: string;
  workoutTitleLoading?: boolean;
  workoutSubtitle?: string | null;
  workoutDuration: string | null;
  workoutImageSrc?: string | null;
  workoutZoneLabel?: string | null;
  weekStats?: MemberHomeWeekStats | null;
  quickActions?: MemberHomeQuickActions;
  betweenSections?: ReactNode;
  headerActions?: ReactNode;
  notificationsPanel?: ReactNode;
  primaryCta: ReactNode;
  onWorkoutCardClick?: () => void;
  belowWorkout?: ReactNode;
  onboardingPrompt?: ReactNode;
  monthlyCheckInPrompt?: ReactNode;
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
  momentumPct,
  weekSessionsLabel,
  weekMinutesLabel,
  workoutTitle,
  workoutTitleLoading = false,
  workoutSubtitle,
  workoutDuration,
  workoutImageSrc,
  workoutZoneLabel,
  primaryCta,
  onWorkoutCardClick,
  quickActions,
  belowWorkout,
  onboardingPrompt,
  monthlyCheckInPrompt,
}: MemberHomeOverviewProps) {
  const streakLabel = streakWeeks > 0 ? `${streakWeeks} ${streakWeeks === 1 ? "uke" : "uker"}` : "0 uker";
  const headerLine = headerMotivation?.trim() || todayDateLabel;

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
            {memberAvatarUrl ? (
              <img src={memberAvatarUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
            ) : (
              <span
                className="flex h-full w-full items-center justify-center text-sm font-semibold text-white"
                style={{ background: `${MOTUS.gradient}` }}
              >
                {memberFirstName.charAt(0).toUpperCase()}
              </span>
            )}
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-[1.25rem] font-semibold leading-tight tracking-tight text-slate-900">
              Hei, {memberFirstName}!
            </h1>
            <p className="mt-0.5 text-sm text-slate-500">{headerLine}</p>
          </div>
        </div>
      </header>

      <article className="motus-home-workout-card motus-image-frame motus-image-frame--hero">
        {workoutImageSrc ? (
          <img
            className="motus-home-workout-cover motus-image-media"
            src={workoutImageSrc}
            alt=""
            loading="lazy"
            style={{ objectPosition: imageObjectPositionFromSrc(workoutImageSrc) }}
          />
        ) : (
          <div className="motus-home-workout-cover motus-home-workout-cover--fallback" aria-hidden>
            <Dumbbell className="h-10 w-10 text-white/60" strokeWidth={1.5} />
          </div>
        )}

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
                  width: `${momentumPct}%`,
                  background: `linear-gradient(90deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)`,
                }}
              />
            </div>
          </div>
        </div>
        <div className="motus-home-dash-kpi-row">
          <div className="motus-home-dash-kpi">
            <span className="motus-home-dash-kpi-value">{weekSessionsLabel ?? "0/0"}</span>
            <span className="motus-home-dash-kpi-label">økter denne uka</span>
          </div>
          <div className="motus-home-dash-kpi">
            <span className="motus-home-dash-kpi-value">{weekMinutesLabel ?? "0 min"}</span>
            <span className="motus-home-dash-kpi-label">trening</span>
          </div>
          <div className="motus-home-dash-kpi">
            <span className="motus-home-dash-kpi-value">{streakLabel}</span>
            <span className="motus-home-dash-kpi-label">på rad</span>
          </div>
        </div>
      </section>

      {belowWorkout}
      {onboardingPrompt ? <div className="w-full">{onboardingPrompt}</div> : null}
      {monthlyCheckInPrompt ? <div className="w-full">{monthlyCheckInPrompt}</div> : null}

      {quickActions ? (
        <section className="motus-home-quick-actions" aria-label="Hurtighandlinger">
          <HomeQuickAction label="Registrer trening" icon={ClipboardList} tone="brand" onClick={quickActions.onLogWorkout} />
          <HomeQuickAction label="Se program" icon={CalendarDays} tone="pink" onClick={quickActions.onViewPrograms} />
          <HomeQuickAction label="Periodeplan" icon={CalendarRange} tone="brand" onClick={quickActions.onViewPeriodPlan} />
          <HomeQuickAction label="Meldinger" icon={MessageSquare} tone="pink" onClick={quickActions.onViewMessages} />
        </section>
      ) : null}
    </div>
  );
}

function HomeQuickAction({
  label,
  icon: Icon,
  tone,
  onClick,
}: {
  label: string;
  icon: typeof ClipboardList;
  tone: "brand" | "pink";
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="motus-home-quick-action motus-pressable text-left">
      <span
        className={`motus-home-quick-action-icon ${tone === "brand" ? "motus-home-quick-action-icon--brand" : "motus-home-quick-action-icon--pink"}`}
        aria-hidden
      >
        <Icon className="h-5 w-5" strokeWidth={2} />
      </span>
      <span className="block text-sm font-semibold leading-tight text-slate-800">{label}</span>
    </button>
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
}: {
  title: string;
  detail: string;
  ctaLabel: string;
  onCta: () => void;
}) {
  return (
    <div className="flex flex-col gap-2.5 rounded-2xl border border-white/70 bg-white/80 px-4 py-3.5 shadow-[0_2px_16px_-10px_rgba(15,23,42,0.14)] backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-800">{title}</p>
        <p className="mt-0.5 text-xs text-slate-500">{detail}</p>
      </div>
      <GradientButton type="button" onClick={onCta} className="h-10 w-full shrink-0 rounded-xl px-4 text-xs font-semibold sm:w-auto">
        {ctaLabel}
      </GradientButton>
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
