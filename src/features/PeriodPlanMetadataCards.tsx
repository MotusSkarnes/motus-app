import { CalendarDays, Clock3, UserRound } from "lucide-react";

type PeriodPlanMetadataCardsProps = {
  startDate: string;
  weeks: number;
  sourceLabel: string;
};

export function PeriodPlanMetadataCards({ startDate, weeks, sourceLabel }: PeriodPlanMetadataCardsProps) {
  const items = [
    { icon: CalendarDays, label: "Start", value: startDate },
    { icon: Clock3, label: "Varighet", value: `${weeks} ${weeks === 1 ? "uke" : "uker"}` },
    { icon: UserRound, label: "Trener", value: sourceLabel },
  ];

  return (
    <div className="motus-period-plan-meta-row" role="group" aria-label="Periodeplan-info">
      {items.map((item) => (
        <div key={item.label} className="motus-period-plan-meta-pill">
          <span className="motus-period-plan-meta-pill-icon" aria-hidden>
            <item.icon className="h-3.5 w-3.5" strokeWidth={2.25} />
          </span>
          <div className="min-w-0">
            <p className="motus-period-plan-meta-pill-label">{item.label}</p>
            <p className="motus-period-plan-meta-pill-value">{item.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
