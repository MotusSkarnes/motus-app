import { Flame, Trophy, Zap } from "lucide-react";

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

const STAT_ICONS = {
  økter: Flame,
  flyt: Zap,
  streak: Trophy,
} as const;

export function MemberTrainingWeekStats({
  completedSessions,
  momentumPct,
  streakWeeks,
}: MemberTrainingWeekStatsProps) {
  const items = [
    { value: String(completedSessions), label: "økter" as const },
    { value: `${momentumPct}%`, label: "flyt" as const },
    { value: streakLabel(streakWeeks), label: "streak" as const },
  ];

  return (
    <div className="flex gap-3 overflow-x-auto pb-0.5 scrollbar-none" aria-label="Ukeoversikt">
      {items.map((item) => {
        const Icon = STAT_ICONS[item.label];
        return (
          <div key={item.label} className="motus-stat-pill shrink-0">
            <span className="motus-stat-pill-icon" aria-hidden>
              <Icon className="h-3.5 w-3.5" strokeWidth={2.25} />
            </span>
            <span className="min-w-0">
              <span className="block text-[17px] font-semibold tabular-nums leading-none tracking-tight text-slate-800">
                {item.value}
              </span>
              <span className="mt-1 block text-[11px] font-medium leading-none text-slate-500">{item.label}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
