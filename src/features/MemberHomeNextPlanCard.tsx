import { CalendarDays, ChevronRight } from "lucide-react";
import { extractZoneFromPlanEntry } from "./MemberTrainingTodayCard";
import { isGroupPeriodPlanEntry } from "../app/periodPlanEntryActions";

type MemberHomeNextPlanCardProps = {
  dayLabel: string;
  entry: string;
  onClick: () => void;
};

function buildNextPlanSubtitle(entry: string): string {
  const zone = extractZoneFromPlanEntry(entry);
  if (isGroupPeriodPlanEntry(entry)) {
    const className = entry.includes(":") ? entry.split(":").slice(1).join(":").trim() : entry.replace(/^gruppetime/i, "").trim();
    const parts = ["Gruppetime", zone ?? (className || null), "60 min"].filter(Boolean);
    return parts.join(" · ");
  }
  if (zone) return `${zone} · ca. 60 min`;
  return "Planlagt økt · ca. 60 min";
}

export function MemberHomeNextPlanCard({ dayLabel, entry, onClick }: MemberHomeNextPlanCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="motus-home-next-plan motus-pressable w-full text-left"
      aria-label={`Neste på planen: ${dayLabel}, ${entry}`}
    >
      <span className="motus-home-next-plan-icon" aria-hidden>
        <CalendarDays className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[10px] font-semibold uppercase tracking-wide text-white/80">Neste på planen</span>
        <span className="mt-1 block text-base font-bold leading-snug text-white">
          {dayLabel} · {entry}
        </span>
        <span className="mt-0.5 block text-xs font-medium text-white/85">{buildNextPlanSubtitle(entry)}</span>
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-white/90" aria-hidden />
    </button>
  );
}

export function MemberHomeStatusGradientCard({
  title,
  detail,
  onClick,
}: {
  title: string;
  detail: string;
  onClick?: () => void;
}) {
  const content = (
    <>
      <span className="motus-home-next-plan-icon" aria-hidden>
        <CalendarDays className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold leading-snug text-white">{title}</span>
        <span className="mt-0.5 block text-xs font-medium text-white/85">{detail}</span>
      </span>
      {onClick ? <ChevronRight className="h-5 w-5 shrink-0 text-white/90" aria-hidden /> : null}
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="motus-home-next-plan motus-pressable w-full text-left">
        {content}
      </button>
    );
  }

  return <div className="motus-home-next-plan">{content}</div>;
}
