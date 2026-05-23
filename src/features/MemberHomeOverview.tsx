import type { ReactNode } from "react";
import { Play } from "lucide-react";
import { MOTUS } from "../app/data";
import { GradientButton, OutlineButton } from "../app/ui";

export type MemberHomeOverviewProps = {
  topStatusText: string;
  emotionalChip: string | null;
  workoutTitle: string;
  workoutHint: string | null;
  momentumPct: number;
  monthGoalCurrent: number;
  monthGoalTarget: number;
  streakWeeks: number;
  streakSubline: string;
  primaryCta: ReactNode;
  secondaryCta?: ReactNode;
  onboardingPrompt?: ReactNode;
  monthlyCheckInPrompt?: ReactNode;
};

export function MemberHomeOverview({
  topStatusText,
  emotionalChip,
  workoutTitle,
  workoutHint,
  momentumPct,
  monthGoalCurrent,
  monthGoalTarget,
  streakWeeks,
  streakSubline,
  primaryCta,
  secondaryCta,
  onboardingPrompt,
  monthlyCheckInPrompt,
}: MemberHomeOverviewProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2 px-0.5">
        <p className="text-sm font-medium text-slate-700">{topStatusText}</p>
        {emotionalChip ? <span className="text-xs font-semibold text-teal-800">{emotionalChip}</span> : null}
      </div>

      <section className="rounded-2xl bg-white px-5 py-5 sm:px-6 sm:py-6">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Dagens økt</p>
        <h2 className="mt-2 text-2xl font-bold leading-tight tracking-tight text-slate-950 sm:text-[1.75rem]">{workoutTitle}</h2>
        {workoutHint ? <p className="mt-1.5 text-sm text-slate-600">{workoutHint}</p> : null}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          {primaryCta}
          {secondaryCta}
        </div>
      </section>

      <section className="space-y-2 px-0.5">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm text-slate-700">
          <span>
            <span className="font-semibold text-slate-950">Momentum</span> {momentumPct}%
          </span>
          <span className="text-slate-300" aria-hidden>
            ·
          </span>
          <span>
            <span className="font-semibold text-slate-950 tabular-nums">
              {monthGoalCurrent}/{monthGoalTarget}
            </span>{" "}
            økter
          </span>
          <span className="text-slate-300" aria-hidden>
            ·
          </span>
          <span>{streakWeeks > 0 ? `${streakWeeks} ukes streak` : "Start streak"}</span>
        </div>
        <div className="motus-progress-track h-1.5 rounded-full">
          <div
            className="motus-progress-fill h-1.5 rounded-full transition-[width] duration-500 ease-out"
            style={{
              width: `${momentumPct}%`,
              background: `linear-gradient(90deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)`,
            }}
          />
        </div>
        {streakSubline ? <p className="text-xs text-slate-500">{streakSubline}</p> : null}
      </section>

      {onboardingPrompt}
      {monthlyCheckInPrompt}
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
    <div className="flex flex-col gap-3 rounded-xl bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <p className="mt-0.5 text-xs text-slate-600">{detail}</p>
      </div>
      <GradientButton type="button" onClick={onCta} className="w-full shrink-0 sm:w-auto">
        {ctaLabel}
      </GradientButton>
    </div>
  );
}

export function MemberHomeStartWorkoutButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <GradientButton type="button" onClick={onClick} className="min-h-11 rounded-xl px-5 text-sm font-semibold sm:min-h-12 sm:text-base">
      <Play className="mr-2 h-4 w-4 fill-white/90" aria-hidden />
      {label}
    </GradientButton>
  );
}

export function MemberHomeSecondaryLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-sm font-semibold text-slate-600 underline-offset-2 transition hover:text-slate-900 hover:underline"
    >
      {label}
    </button>
  );
}

export function MemberHomeOutlineSecondary({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <OutlineButton type="button" onClick={onClick} className="min-h-11 rounded-xl border-slate-200 bg-white px-4 text-sm font-semibold sm:min-h-12">
      {label}
    </OutlineButton>
  );
}
