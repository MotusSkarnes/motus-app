import { Clock3, Dumbbell, Play, Zap } from "lucide-react";
import { TrainingStartButton } from "../app/ui";

export function extractZoneFromPlanEntry(entry: string): string | null {
  const zoneMatch = entry.match(/sone\s*(\d+)/i);
  if (zoneMatch) return `Sone ${zoneMatch[1]}`;
  if (/gruppetime|spinning|yoga|pilates/i.test(entry)) return "Gruppe";
  if (/kondisjon|løp|mølle|intervall|ro/i.test(entry)) return "Kondisjon";
  if (/styrke|press|løft|hypertrofi/i.test(entry)) return "Styrke";
  return null;
}

export function formatWeekSessionsLabel(completed: number, planned: number, weeklyTarget?: number): string {
  const denominator = Math.max(planned, weeklyTarget ?? 0, completed > 0 ? completed : 0);
  if (denominator <= 0) {
    return completed === 1 ? "1 økt denne uka" : `${completed} økter denne uka`;
  }
  return `${completed}/${denominator} økter denne uka`;
}

type MemberTrainingTodayCardProps = {
  title: string;
  imageSrc: string | null;
  durationLabel: string | null;
  zoneLabel: string | null;
  weekSessionsLabel: string;
  primaryAction?: {
    label: string;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  tertiaryAction?: {
    label: string;
    onClick: () => void;
  };
};

export function MemberTrainingTodayCard({
  title,
  imageSrc,
  durationLabel,
  zoneLabel,
  weekSessionsLabel,
  primaryAction,
  secondaryAction,
  tertiaryAction,
}: MemberTrainingTodayCardProps) {
  const hasPlan = Boolean(primaryAction);
  const metadata = [durationLabel, zoneLabel, weekSessionsLabel].filter(Boolean);

  return (
    <article className="motus-training-today-card">
      <div className="flex gap-4">
        <div className="motus-training-today-thumb shrink-0" aria-hidden={!imageSrc}>
          {imageSrc ? (
            <img src={imageSrc} alt="" className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-teal-100/80 to-slate-100">
              <Dumbbell className="h-7 w-7 text-teal-600/70" strokeWidth={1.75} />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1 pt-0.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-teal-700/90">Dagens plan</p>
          <h2 className="mt-1.5 text-[1.35rem] font-semibold leading-tight tracking-tight text-slate-950">{title}</h2>
          {metadata.length > 0 ? (
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] font-medium text-slate-600">
              {durationLabel ? (
                <span className="inline-flex items-center gap-1.5">
                  <Clock3 className="h-3.5 w-3.5 text-slate-400" aria-hidden />
                  {durationLabel}
                </span>
              ) : null}
              {zoneLabel ? (
                <span className="inline-flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5 text-slate-400" aria-hidden />
                  {zoneLabel}
                </span>
              ) : null}
              {weekSessionsLabel ? (
                <span className="inline-flex items-center gap-1.5 text-slate-500">{weekSessionsLabel}</span>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-5 space-y-2.5">
        {primaryAction ? (
          <TrainingStartButton onClick={primaryAction.onClick} className="w-full">
            <Play className="h-4 w-4 fill-white/85" aria-hidden />
            {primaryAction.label}
          </TrainingStartButton>
        ) : null}

        {!hasPlan ? (
          <p className="text-sm leading-relaxed text-slate-500">
            Ingen plan i dag — start et program eller lag en egen økt.
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {secondaryAction ? (
            <button
              type="button"
              onClick={secondaryAction.onClick}
              className="text-sm font-medium text-teal-700 transition hover:text-teal-800"
            >
              {secondaryAction.label}
            </button>
          ) : null}
          {tertiaryAction ? (
            <button
              type="button"
              onClick={tertiaryAction.onClick}
              className="text-sm font-medium text-slate-500 transition hover:text-slate-700"
            >
              {tertiaryAction.label}
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
