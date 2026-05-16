import { CalendarDays, Flame } from "lucide-react";
import { MOTUS } from "../app/data";
import type { MemberProgressState } from "../app/memberProgressGamification";
import { MemberWeeklyStreakCard } from "./MemberWeeklyStreakCard";

type MemberHabitSummaryCardProps = {
  progress: MemberProgressState;
  onOpenProgress?: () => void;
};

export function MemberHabitSummaryCard({ progress, onOpenProgress }: MemberHabitSummaryCardProps) {
  const monthPct = Math.min(100, Math.round((Math.min(progress.monthGoal.current, progress.monthGoal.target) / progress.monthGoal.target) * 100));

  return (
    <div className="w-full rounded-2xl border bg-white p-5 shadow-sm" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div
            className="rounded-xl p-2 text-white shadow-sm"
            style={{ background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` }}
          >
            <Flame className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-800">Din treningsrytme</div>
            <p className="text-xs text-slate-500">Én økt per uke holder vanen — ikke perfekt, bare jevn</p>
          </div>
        </div>
        {onOpenProgress ? (
          <button type="button" onClick={onOpenProgress} className="text-xs font-semibold text-teal-700 underline-offset-2 hover:underline">
            Se alle steg
          </button>
        ) : null}
      </div>

      <MemberWeeklyStreakCard
        compact
        streakWeeks={progress.streakWeeks}
        streakSubline={progress.streakSubline}
        recentStreakWeeks={progress.recentStreakWeeks}
        currentStreakMilestoneTarget={progress.streakMilestoneTarget}
      />

      <div className="mt-3 rounded-xl border bg-slate-50 px-3 py-3" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
            <CalendarDays className="h-3.5 w-3.5" />
            Denne måneden
          </div>
          <span className="text-sm font-semibold tabular-nums text-slate-800">
            {progress.monthGoal.current}/{progress.monthGoal.target} økter
          </span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
          <div
            className="h-2 rounded-full"
            style={{
              width: `${monthPct}%`,
              background: `linear-gradient(90deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)`,
            }}
          />
        </div>
        <p className="mt-1.5 text-xs text-slate-500">{progress.monthGoal.encouragement}</p>
      </div>
    </div>
  );
}
