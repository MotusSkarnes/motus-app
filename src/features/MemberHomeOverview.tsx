import type { ReactNode } from "react";
import { ChevronRight, Play } from "lucide-react";
import { GradientButton, OutlineButton } from "../app/ui";

export type MemberHomeStatusCard = {
  title: string;
  detail: string;
  onClick?: () => void;
};

export type MemberHomeOverviewProps = {
  memberFirstName: string;
  streakLine: string | null;
  motivationLine: string | null;
  statusCard: MemberHomeStatusCard | null;
  workoutTitle: string;
  workoutDuration: string | null;
  sessionCount: number;
  flowPct: number;
  streakWeeks: number;
  primaryCta: ReactNode;
  secondaryCta?: ReactNode;
  onboardingPrompt?: ReactNode;
  monthlyCheckInPrompt?: ReactNode;
};

export function MemberHomeOverview({
  memberFirstName,
  streakLine,
  motivationLine,
  statusCard,
  workoutTitle,
  workoutDuration,
  sessionCount,
  flowPct,
  streakWeeks,
  primaryCta,
  secondaryCta,
  onboardingPrompt,
  monthlyCheckInPrompt,
}: MemberHomeOverviewProps) {
  return (
    <div className="motus-fade-in-up space-y-5">
      <header className="px-0.5">
        <h1 className="text-xl font-semibold tracking-tight text-slate-950 sm:text-[1.35rem]">Hei {memberFirstName}</h1>
        {streakLine ? <p className="mt-1 text-sm text-slate-600">{streakLine}</p> : null}
        {motivationLine ? <p className="mt-0.5 text-sm leading-snug text-slate-500">{motivationLine}</p> : null}
      </header>

      {statusCard ? (
        statusCard.onClick ? (
          <button
            type="button"
            onClick={statusCard.onClick}
            className="motus-pressable flex w-full items-center justify-between gap-3 rounded-xl bg-slate-50/90 px-3.5 py-2.5 text-left transition hover:bg-slate-100/90"
          >
            <StatusCardContent title={statusCard.title} detail={statusCard.detail} />
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
          </button>
        ) : (
          <div className="rounded-xl bg-slate-50/90 px-3.5 py-2.5">
            <StatusCardContent title={statusCard.title} detail={statusCard.detail} />
          </div>
        )
      ) : null}

      <section className="rounded-xl bg-white px-4 py-4 ring-1 ring-slate-900/[0.06]">
        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Dagens økt</p>
        <h2 className="mt-1.5 text-lg font-semibold leading-snug tracking-tight text-slate-950">{workoutTitle}</h2>
        {workoutDuration ? <p className="mt-0.5 text-sm text-slate-500">{workoutDuration}</p> : null}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {primaryCta}
          {secondaryCta}
        </div>
      </section>

      <div className="flex flex-wrap gap-2 px-0.5">
        <StatChip label={`${sessionCount} økter`} />
        <StatChip label={`${flowPct}% flyt`} />
        <StatChip label={streakWeeks > 0 ? `${streakWeeks} ukes streak` : "Start streak"} />
      </div>

      {onboardingPrompt}
      {monthlyCheckInPrompt}
    </div>
  );
}

function StatusCardContent({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="min-w-0">
      <p className="text-sm font-medium text-slate-800">{title}</p>
      <p className="mt-0.5 text-xs text-slate-500">{detail}</p>
    </div>
  );
}

function StatChip({ label }: { label: string }) {
  return <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">{label}</span>;
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
    <div className="flex flex-col gap-2 rounded-xl bg-slate-50/90 px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between">
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
