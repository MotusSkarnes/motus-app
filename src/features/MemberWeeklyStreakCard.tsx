import { Flame } from "lucide-react";
import { MOTUS } from "../app/data";
import type { RecentStreakWeek } from "../app/memberProgressGamification";

type MemberWeeklyStreakCardProps = {
  streakWeeks: number;
  streakSubline: string;
  recentStreakWeeks: RecentStreakWeek[];
  currentStreakMilestoneTarget: number;
  compact?: boolean;
};

export function MemberWeeklyStreakCard({
  streakWeeks,
  streakSubline,
  recentStreakWeeks,
  currentStreakMilestoneTarget,
  compact = false,
}: MemberWeeklyStreakCardProps) {
  const showMilestoneProgress = streakWeeks > 0 && streakWeeks < currentStreakMilestoneTarget;

  return (
    <div
      className={`overflow-hidden rounded-xl border ${compact ? "mt-0" : "mt-3"}`}
      style={{
        borderColor: "rgba(48,227,190,0.22)",
        background: `linear-gradient(135deg, ${MOTUS.paleMint} 0%, #ffffff 52%, rgba(217,18,120,0.06) 100%)`,
      }}
    >
      <div className="h-1" style={{ background: `linear-gradient(90deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` }} />
      <div className={compact ? "p-3" : "p-4"}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Streak</div>
            <p className="mt-0.5 text-[11px] text-slate-500">Minst én fullført økt per kalenderuke</p>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              {streakWeeks > 0 ? (
                <>
                  <span className={`font-bold tabular-nums tracking-tight text-slate-900 ${compact ? "text-2xl" : "text-3xl"}`}>
                    {streakWeeks}
                  </span>
                  <span className="text-sm font-semibold text-slate-700">ukers streak</span>
                </>
              ) : (
                <span className="text-base font-semibold text-slate-800 sm:text-lg">Ingen aktiv streak ennå</span>
              )}
            </div>
            <p className={`leading-relaxed text-slate-600 ${compact ? "mt-1.5 text-xs" : "mt-2 text-sm"}`}>{streakSubline}</p>
          </div>
          <div
            className="shrink-0 rounded-xl p-2.5 text-white shadow-sm"
            style={{ background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` }}
          >
            <Flame className={compact ? "h-4 w-4" : "h-5 w-5"} />
          </div>
        </div>
        {!compact ? (
          <div className="mt-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
              <span>Siste 8 uker</span>
              <span className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-sm border border-slate-200 bg-slate-100" />
                  Ingen økt
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-sm bg-emerald-400" />
                  Med økt
                </span>
                <span className="inline-flex items-center gap-1">
                  <span
                    className="inline-block h-2 w-2 rounded-sm"
                    style={{ background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` }}
                  />
                  I streak
                </span>
              </span>
            </div>
            <div className="grid grid-cols-8 gap-1">
              {recentStreakWeeks.map((week) => (
                <div key={week.key} className="flex min-w-0 flex-col items-center gap-1">
                  <div
                    title={week.trained ? (week.inActiveStreak ? "Økt logget · teller i streaken" : "Økt logget") : "Ingen økt denne uken"}
                    className={`h-9 w-full rounded-lg border transition ${week.inActiveStreak ? "ring-2 ring-teal-400/80 ring-offset-1" : ""}`}
                    style={
                      week.inActiveStreak
                        ? {
                            background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)`,
                            borderColor: "transparent",
                          }
                        : week.trained
                          ? { backgroundColor: "rgba(52,211,153,0.35)", borderColor: "rgba(16,185,129,0.45)" }
                          : { backgroundColor: "rgba(248,250,252,0.9)", borderColor: "rgba(148,163,184,0.35)" }
                    }
                  />
                  <span className="truncate text-[10px] font-medium text-slate-500">{week.shortLabel}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        {showMilestoneProgress ? (
          <div className={compact ? "mt-3" : "mt-4"}>
            <div className="flex items-center justify-between gap-2 text-[11px] font-medium text-slate-600">
              <span>Ukemål for neste steg</span>
              <span className="tabular-nums">
                {streakWeeks}/{currentStreakMilestoneTarget} uker
              </span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/80">
              <div
                className="h-2 rounded-full"
                style={{
                  width: `${Math.min(100, Math.round((streakWeeks / currentStreakMilestoneTarget) * 100))}%`,
                  background: `linear-gradient(90deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)`,
                }}
              />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
