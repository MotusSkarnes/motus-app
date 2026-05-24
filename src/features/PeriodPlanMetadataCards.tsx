import { CalendarDays, Clock3, UserRound } from "lucide-react";

type PeriodPlanMetadataCardsProps = {
  startDate: string;
  weeks: number;
  sourceLabel: string;
};

export function PeriodPlanMetadataCards({ startDate, weeks, sourceLabel }: PeriodPlanMetadataCardsProps) {
  const items = [
    { icon: CalendarDays, label: "Startdato", value: startDate },
    { icon: Clock3, label: "Varighet", value: `${weeks} ${weeks === 1 ? "uke" : "uker"}` },
    { icon: UserRound, label: "Trener", value: sourceLabel },
  ];

  return (
    <div className="motus-period-plan-meta-grid">
      {items.map((item) => (
        <div key={item.label} className="motus-period-plan-meta-card">
          <span className="motus-period-plan-meta-icon" aria-hidden>
            <item.icon className="h-4 w-4" strokeWidth={2.25} />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{item.label}</p>
            <p className="mt-0.5 truncate text-sm font-bold text-slate-950">{item.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
