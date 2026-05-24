import type { ReactNode } from "react";
import {
  BarChart3,
  Bookmark,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  Clock3,
  Dumbbell,
  Flame,
  Play,
  Timer,
} from "lucide-react";
import { MOTUS } from "../app/data";
import { GradientButton, OutlineButton, TrainingStartButton } from "../app/ui";
import { MotusFlameIcon } from "./MotusFlameIcon";

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
  onViewProgress: () => void;
};

export type MemberHomeOverviewProps = {
  memberFirstName: string;
  todayDateLabel: string;
  memberAvatarUrl?: string | null;
  onOpenProfile?: () => void;
  streakWeeks: number;
  dashboardHeadline: string;
  dashboardSubline?: string | null;
  momentumPct: number;
  dailyGoalLabel?: string | null;
  weekSessionsLabel?: string | null;
  weekMinutesLabel?: string | null;
  motivationLine: string | null;
  statusCard: MemberHomeStatusCard | null;
  workoutTitle: string;
  workoutTitleLoading?: boolean;
  workoutSubtitle?: string | null;
  workoutDuration: string | null;
  workoutImageSrc?: string | null;
  workoutZoneLabel?: string | null;
  weekStats?: MemberHomeWeekStats | null;
  quickActions: MemberHomeQuickActions;
  betweenSections?: ReactNode;
  headerActions?: ReactNode;
  notificationsPanel?: ReactNode;
  primaryCta: ReactNode;
  onWorkoutCardClick?: () => void;
  onboardingPrompt?: ReactNode;
  monthlyCheckInPrompt?: ReactNode;
};

export function MemberHomeOverview({
  memberFirstName,
  todayDateLabel,
  memberAvatarUrl,
  onOpenProfile,
  streakWeeks,
  dashboardHeadline,
  dashboardSubline,
  momentumPct,
  dailyGoalLabel,
  weekSessionsLabel,
  weekMinutesLabel,
  motivationLine,
  statusCard,
  workoutTitle,
  workoutTitleLoading = false,
  workoutSubtitle,
  workoutDuration,
  workoutImageSrc,
  workoutZoneLabel,
  quickActions,
  betweenSections,
  primaryCta,
  onWorkoutCardClick,
  onboardingPrompt,
  monthlyCheckInPrompt,
}: MemberHomeOverviewProps) {
  return (
    <div className="motus-home motus-fade-in-up">
      <header className="px-0.5 pt-0.5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onOpenProfile}
            className="motus-pressable relative h-11 w-11 shrink-0 overflow-hidden rounded-full ring-2 ring-white shadow-[0_2px_10px_-4px_rgba(15,23,42,0.25)]"
            aria-label="Åpne profil"
          >
            {memberAvatarUrl ? (
              <img src={memberAvatarUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
            ) : (
              <span
                className="flex h-full w-full items-center justify-center text-sm font-semibold text-white"
                style={{ background: `linear-gradient(135deg, ${MOTUS.turquoise}, ${MOTUS.pink})` }}
              >
                {memberFirstName.charAt(0).toUpperCase()}
              </span>
            )}
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-[1.25rem] font-semibold leading-tight tracking-tight text-slate-900">
              Hei, {memberFirstName}!
            </h1>
            <p className="mt-0.5 text-sm text-slate-500">{todayDateLabel}</p>
          </div>
        </div>
      </header>

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
              <MotusFlameIcon className="h-8 w-8" title="" />
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
        <div className="motus-home-dash-stats">
          {dailyGoalLabel ? (
            <div className="motus-home-dash-stat">
              <span className="motus-home-dash-stat-icon" aria-hidden>
                <Clock3 className="h-3.5 w-3.5" />
              </span>
              <span>
                <span className="motus-home-dash-stat-label">Dagens mål</span>
                <span className="motus-home-dash-stat-value">{dailyGoalLabel}</span>
              </span>
            </div>
          ) : null}
          {weekSessionsLabel ? (
            <div className="motus-home-dash-stat">
              <span className="motus-home-dash-stat-icon" aria-hidden>
                <Dumbbell className="h-3.5 w-3.5" />
              </span>
              <span>
                <span className="motus-home-dash-stat-label">Økter denne uka</span>
                <span className="motus-home-dash-stat-value">{weekSessionsLabel}</span>
              </span>
            </div>
          ) : null}
          {weekMinutesLabel ? (
            <div className="motus-home-dash-stat">
              <span className="motus-home-dash-stat-icon" aria-hidden>
                <Timer className="h-3.5 w-3.5" />
              </span>
              <span>
                <span className="motus-home-dash-stat-label">Treningsminutter</span>
                <span className="motus-home-dash-stat-value">{weekMinutesLabel}</span>
              </span>
            </div>
          ) : null}
          <div className="motus-home-dash-stat">
            <span className="motus-home-dash-stat-icon motus-home-dash-stat-icon--pink" aria-hidden>
              <Flame className="h-3.5 w-3.5" />
            </span>
            <span>
              <span className="motus-home-dash-stat-label">Flyt</span>
              <span className="motus-home-dash-stat-value">{momentumPct}%</span>
            </span>
          </div>
        </div>
      </section>

      <article className="motus-home-workout-card">
        {workoutImageSrc ? (
          <img className="motus-home-workout-cover" src={workoutImageSrc} alt="" loading="lazy" />
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
          <div className="min-w-0">
            <p className="motus-home-workout-label">Dagens plan</p>
            <h2
              className={`motus-home-workout-title ${workoutTitleLoading ? "animate-pulse text-slate-400" : ""}`}
            >
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
                  <span aria-hidden>•</span>
                  {workoutZoneLabel}
                </span>
              ) : null}
            </div>
          </div>
          {workoutSubtitle ? <p className="motus-home-workout-subtitle">{workoutSubtitle}</p> : null}
          {primaryCta ? <div className="motus-home-workout-cta">{primaryCta}</div> : null}
        </div>
      </article>

      <section className="grid grid-cols-3 gap-2" aria-label="Hurtighandlinger">
        <HomeQuickAction
          label="Registrer trening"
          icon={ClipboardList}
          tone="brand"
          onClick={quickActions.onLogWorkout}
        />
        <HomeQuickAction label="Se program" icon={CalendarDays} tone="pink" onClick={quickActions.onViewPrograms} />
        <HomeQuickAction
          label="Fremgang"
          icon={BarChart3}
          tone="pink"
          onClick={quickActions.onViewProgress}
        />
      </section>

      {betweenSections ? <div className="px-0.5">{betweenSections}</div> : null}

      {statusCard ? (
        <div className="px-0.5">
          <HomeStatusRow statusCard={statusCard} />
        </div>
      ) : null}

      {onboardingPrompt ? <div className="px-0.5">{onboardingPrompt}</div> : null}
      {monthlyCheckInPrompt ? <div className="px-0.5">{monthlyCheckInPrompt}</div> : null}

      {motivationLine ? (
        <aside className="motus-home-boost-card">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-pink-700/80">Dagens boost</p>
            <p className="mt-2 text-[0.9375rem] font-medium leading-relaxed text-slate-800">&ldquo;{motivationLine}&rdquo;</p>
          </div>
        </aside>
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
      <span className="mt-2.5 block text-center text-[11px] font-semibold leading-snug text-slate-700">{label}</span>
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
      <Play className="h-4 w-4 fill-slate-900/80" aria-hidden />
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
