import type { ReactNode } from "react";
import { ChevronRight, Clock3, Dumbbell, Play, Zap } from "lucide-react";
import { GradientButton, OutlineButton, TrainingStartButton } from "../app/ui";
import { MotusFlameIcon } from "./MotusFlameIcon";
import { MemberTrainingWeekStats } from "./MemberTrainingWeekStats";

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

export type MemberHomeOverviewProps = {
  memberFirstName: string;
  streakWeeks: number;
  motivationLine: string | null;
  statusCard: MemberHomeStatusCard | null;
  workoutTitle: string;
  workoutDuration: string | null;
  workoutImageSrc?: string | null;
  workoutZoneLabel?: string | null;
  weekSessionsLabel?: string | null;
  weekStats?: MemberHomeWeekStats | null;
  headerActions?: ReactNode;
  notificationsPanel?: ReactNode;
  primaryCta: ReactNode;
  secondaryCta?: ReactNode;
  onboardingPrompt?: ReactNode;
  monthlyCheckInPrompt?: ReactNode;
};

export function MemberHomeOverview({
  memberFirstName,
  streakWeeks,
  motivationLine,
  statusCard,
  workoutTitle,
  workoutDuration,
  workoutImageSrc,
  workoutZoneLabel,
  weekSessionsLabel,
  weekStats,
  headerActions,
  notificationsPanel,
  primaryCta,
  secondaryCta,
  onboardingPrompt,
  monthlyCheckInPrompt,
}: MemberHomeOverviewProps) {
  const metadata = [workoutDuration, workoutZoneLabel, weekSessionsLabel].filter(Boolean);

  return (
    <div className="motus-home motus-fade-in-up">
      <div className="motus-home-top">
        <header className="relative px-1">
          <div className="pointer-events-none absolute -left-6 -right-6 -top-8 h-36 bg-[radial-gradient(ellipse_at_top,rgba(48,227,190,0.14),transparent_68%)]" aria-hidden />
          <div className="relative flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Motus</p>
              <h1 className="text-[1.75rem] font-semibold leading-tight tracking-tight text-slate-800 sm:text-[2rem]">
                Hei {memberFirstName}
              </h1>
              {streakWeeks > 0 ? (
                <p className="flex items-center gap-1.5 text-sm font-medium text-slate-600">
                  <MotusFlameIcon className="h-4 w-4 shrink-0" title="Streak" />
                  <span>{streakWeeks} ukers streak</span>
                </p>
              ) : null}
              {motivationLine ? <p className="max-w-sm text-sm leading-relaxed text-slate-500">{motivationLine}</p> : null}
            </div>
            {headerActions}
          </div>
          {notificationsPanel ? <div className="relative mt-4">{notificationsPanel}</div> : null}
        </header>

        {weekStats ? (
          <div className="mt-5 px-0.5">
            <MemberTrainingWeekStats
              completedSessions={weekStats.completedSessions}
              momentumPct={weekStats.momentumPct}
              streakWeeks={weekStats.streakWeeks}
            />
          </div>
        ) : null}
      </div>

      {statusCard ? (
        <div className="px-0.5">
          <HomeStatusRow statusCard={statusCard} />
        </div>
      ) : null}

      <article className="motus-home-hero-card">
        <div className="flex gap-4">
          <div className="motus-home-hero-thumb shrink-0" aria-hidden>
            {workoutImageSrc ? (
              <img src={workoutImageSrc} alt="" className="h-full w-full object-cover" loading="lazy" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#ecfdf8] to-[#f4f6f8]">
                <Dumbbell className="h-8 w-8 motus-brand-icon-muted" strokeWidth={1.75} />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] motus-brand-text">Dagens økt</p>
            <h2 className="mt-1.5 text-[1.4rem] font-semibold leading-[1.2] tracking-tight text-slate-800">{workoutTitle}</h2>
            {metadata.length > 0 ? (
              <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] font-medium text-slate-500">
                {workoutDuration ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Clock3 className="h-3.5 w-3.5 text-slate-400" aria-hidden />
                    {workoutDuration}
                  </span>
                ) : null}
                {workoutZoneLabel ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Zap className="h-3.5 w-3.5 text-slate-400" aria-hidden />
                    {workoutZoneLabel}
                  </span>
                ) : null}
                {weekSessionsLabel ? <span>{weekSessionsLabel}</span> : null}
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center">
          {primaryCta}
          {secondaryCta}
        </div>
      </article>

      {onboardingPrompt ? <div className="px-0.5">{onboardingPrompt}</div> : null}
      {monthlyCheckInPrompt ? <div className="px-0.5">{monthlyCheckInPrompt}</div> : null}
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
    <TrainingStartButton type="button" onClick={onClick} className="motus-home-start-btn w-full sm:w-auto sm:min-w-[11rem]">
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
