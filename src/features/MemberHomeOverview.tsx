import type { ReactNode } from "react";
import { ChevronRight, Play } from "lucide-react";
import { GradientButton, OutlineButton } from "../app/ui";
import { MotusFlameIcon } from "./MotusFlameIcon";

export type MemberHomeStatusCard = {
  title: string;
  detail: string;
  onClick?: () => void;
};

export type MemberHomeOverviewProps = {
  memberFirstName: string;
  streakWeeks: number;
  motivationLine: string | null;
  statusCard: MemberHomeStatusCard | null;
  workoutTitle: string;
  workoutDuration: string | null;
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
  headerActions,
  notificationsPanel,
  primaryCta,
  secondaryCta,
  onboardingPrompt,
  monthlyCheckInPrompt,
}: MemberHomeOverviewProps) {
  return (
    <div className="motus-fade-in-up space-y-5">
      <header className="px-0.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-[1.65rem]">Hei {memberFirstName}</h1>
            {streakWeeks > 0 ? (
              <p className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
                <MotusFlameIcon className="h-4 w-4 shrink-0" title="Streak" />
                <span>{streakWeeks} ukers streak</span>
              </p>
            ) : null}
            {motivationLine ? <p className="text-sm leading-relaxed text-slate-500">{motivationLine}</p> : null}
          </div>
          {headerActions}
        </div>
        {notificationsPanel ? <div className="mt-3">{notificationsPanel}</div> : null}
      </header>

      {statusCard ? <HomeStatusRow statusCard={statusCard} /> : null}

      <section className="relative overflow-hidden rounded-2xl bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-slate-900/[0.06] sm:px-5 sm:py-4">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-teal-400/70 via-teal-300/30 to-pink-400/70"
        />
        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">Dagens økt</p>
        <h2 className="mt-1.5 text-lg font-semibold leading-snug tracking-tight text-slate-950">{workoutTitle}</h2>
        {workoutDuration ? <p className="mt-0.5 text-sm tabular-nums text-slate-500">{workoutDuration}</p> : null}
        <div className="mt-3.5 flex flex-wrap items-center gap-2">
          {primaryCta}
          {secondaryCta}
        </div>
      </section>

      {onboardingPrompt}
      {monthlyCheckInPrompt}
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
        className="motus-pressable group flex w-full items-center justify-between gap-3 rounded-lg px-0.5 py-1 text-left transition hover:opacity-80"
      >
        <span className="min-w-0 space-y-0.5">{inner}</span>
        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400 transition group-hover:text-slate-600" aria-hidden />
      </button>
    );
  }

  return <div className="space-y-0.5 px-0.5 py-1">{inner}</div>;
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
    <div className="flex flex-col gap-2 rounded-xl bg-slate-50/70 px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-800">{title}</p>
        <p className="mt-0.5 text-xs text-slate-500">{detail}</p>
      </div>
      <GradientButton type="button" onClick={onCta} className="h-9 w-full shrink-0 rounded-lg px-3 text-xs font-semibold sm:w-auto">
        {ctaLabel}
      </GradientButton>
    </div>
  );
}

export function MemberHomeStartWorkoutButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <GradientButton type="button" onClick={onClick} className="motus-pressable h-10 rounded-lg px-4 text-sm font-semibold">
      <Play className="mr-1.5 h-3.5 w-3.5 fill-white/90" aria-hidden />
      {label}
    </GradientButton>
  );
}

export function MemberHomeSecondaryLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <OutlineButton type="button" onClick={onClick} className="motus-pressable h-10 rounded-lg border-slate-200/80 bg-white px-4 text-sm font-medium text-slate-700">
      {label}
    </OutlineButton>
  );
}
