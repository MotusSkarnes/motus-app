import { MotusFlameIcon } from "./MotusFlameIcon";
import { MOTUS } from "../app/data";
import type { RecentStreakWeek } from "../app/memberProgressGamification";

type MemberWeeklyStreakCardProps = {
  streakWeeks: number;
  streakSubline: string;
  recentStreakWeeks: RecentStreakWeek[];
  currentStreakMilestoneTarget: number;
  compact?: boolean;
  variant?: "default" | "flow";
};

export function MemberWeeklyStreakCard({
  streakWeeks,
  streakSubline,
  recentStreakWeeks,
  currentStreakMilestoneTarget,
  compact = false,
  variant = "default",
}: MemberWeeklyStreakCardProps) {
  const showMilestoneProgress = streakWeeks > 0 && streakWeeks < currentStreakMilestoneTarget;
  const isFlow = variant === "flow";

  return (
    <div className={isFlow ? "motus-progress-streak-block" : `motus-card overflow-hidden ${compact ? "mt-0" : "mt-3"}`}>
      <div className={isFlow ? "" : "p-4"}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h4 className="text-sm font-semibold text-slate-900">{isFlow ? "Ukers streak" : "Streak"}</h4>
            {!isFlow ? <p className="mt-0.5 text-[11px] text-slate-500">Minst én fullført økt per kalenderuke</p> : null}
            <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              {streakWeeks > 0 ? (
                <>
                  <span className={`font-black tabular-nums tracking-tight text-slate-950 ${compact ? "text-2xl" : "text-3xl"}`}>
                    {streakWeeks}
                  </span>
                  <span className="text-sm font-semibold text-slate-600">ukers streak</span>
                </>
              ) : (
                <span className="text-base font-semibold text-slate-800 sm:text-lg">Ingen aktiv streak ennå</span>
              )}
            </div>
            <p className={`leading-relaxed text-slate-600 ${compact ? "mt-1.5 text-xs" : "mt-2 text-sm"}`}>{streakSubline}</p>
          </div>
          <div className={`shrink-0 rounded-xl bg-[#F3F5F7] p-2.5 ${streakWeeks > 0 ? "motus-soft-pulse" : ""}`}>
            <MotusFlameIcon className={compact ? "h-4 w-4" : "h-5 w-5"} />
          </div>
        </div>

        {!compact ? (
          <div className="mt-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
              <span>Siste 8 uker</span>
              <span className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-1">
                  <span className="motus-progress-streak-legend motus-progress-streak-legend--empty" />
                  Ingen økt
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="motus-progress-streak-legend motus-progress-streak-legend--trained" />
                  Med økt
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="motus-progress-streak-legend motus-progress-streak-legend--active" />
                  I streak
                </span>
              </span>
            </div>
            <div className="grid grid-cols-8 gap-1.5">
              {recentStreakWeeks.map((week) => (
                <div key={week.key} className="flex min-w-0 flex-col items-center gap-1">
                  <div
                    title={week.trained ? (week.inActiveStreak ? "Økt logget · teller i streaken" : "Økt logget") : "Ingen økt denne uken"}
                    className={`motus-progress-streak-cell ${
                      week.inActiveStreak
                        ? "motus-progress-streak-cell--active"
                        : week.trained
                          ? "motus-progress-streak-cell--trained"
                          : "motus-progress-streak-cell--empty"
                    }`}
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
              <span>{isFlow ? `${streakWeeks} / ${currentStreakMilestoneTarget} uker mot neste steg` : "Ukemål for neste steg"}</span>
              <span className="tabular-nums">
                {streakWeeks}/{currentStreakMilestoneTarget} uker
              </span>
            </div>
            <div className="motus-progress-track mt-1.5 h-2 rounded-full">
              <div
                className="motus-progress-fill h-2 rounded-full"
                style={{
                  width: `${Math.min(100, Math.round((streakWeeks / currentStreakMilestoneTarget) * 100))}%`,
                  background: `${MOTUS.gradient}`,
                }}
              />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
