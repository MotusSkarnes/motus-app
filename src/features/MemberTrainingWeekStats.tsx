type MemberTrainingWeekStatsProps = {
  completedSessions: number;
  momentumPct: number;
  streakWeeks: number;
};

function streakLabel(weeks: number): string {
  if (weeks <= 0) return "0 uker";
  if (weeks === 1) return "1 uke";
  return `${weeks} uker`;
}

export function MemberTrainingWeekStats({
  completedSessions,
  momentumPct,
  streakWeeks,
}: MemberTrainingWeekStatsProps) {
  const items = [
    { value: String(completedSessions), label: "økter" },
    { value: `${momentumPct}%`, label: "flyt" },
    { value: streakLabel(streakWeeks), label: "streak" },
  ];

  return (
    <div className="flex gap-2.5 overflow-x-auto pb-0.5 scrollbar-none" aria-label="Ukeoversikt">
      {items.map((item) => (
        <div key={item.label} className="motus-training-stat-chip shrink-0">
          <span className="text-[17px] font-semibold tabular-nums leading-none tracking-tight text-slate-950">
            {item.value}
          </span>
          <span className="mt-1 text-[11px] font-medium leading-none text-slate-500">{item.label}</span>
        </div>
      ))}
    </div>
  );
}
