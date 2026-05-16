import { MOTUS } from "../app/data";
import type { ProgressGoal } from "../app/memberProgressGamification";

type MemberProgressGoalsProps = {
  goals: ProgressGoal[];
  workingLevel: number;
  stepLabel: string;
  hasCompletedAllLevels: boolean;
};

export function MemberProgressGoals({ goals, workingLevel, stepLabel, hasCompletedAllLevels }: MemberProgressGoalsProps) {
  const unlockedCount = goals.filter((goal) => goal.unlocked).length;

  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-sm font-semibold text-slate-900">
            {hasCompletedAllLevels ? "Alle steg fullført" : `Mål for steg ${workingLevel}`}
          </h4>
          <p className="mt-0.5 text-xs text-slate-500">
            {hasCompletedAllLevels
              ? "Du har nådd høyeste steg — fortsett treningen for å holde vanen."
              : `«${stepLabel}» — fullfør alle tre for å gå videre.`}
          </p>
        </div>
        {!hasCompletedAllLevels ? (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
            {unlockedCount}/{goals.length} klart
          </span>
        ) : null}
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {goals.map((goal) => {
          const progressPct = Math.min(100, Math.round((Math.min(goal.current, goal.target) / goal.target) * 100));
          return (
            <div
              key={goal.id}
              className={`rounded-xl border px-3 py-3 text-sm ${
                goal.unlocked ? "border-emerald-300 bg-emerald-50/80 text-emerald-900" : "border-slate-200 bg-white text-slate-700"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold">{goal.title}</div>
                  <p className="mt-0.5 text-[11px] leading-snug opacity-90">{goal.description}</p>
                </div>
                <span className="text-lg" aria-hidden>
                  {goal.unlocked ? "✓" : goal.emoji}
                </span>
              </div>
              <div className="mt-2.5 h-1.5 rounded-full bg-slate-200/80">
                <div
                  className="h-1.5 rounded-full transition-all"
                  style={{
                    width: `${progressPct}%`,
                    background: goal.unlocked
                      ? "rgb(16 185 129)"
                      : `linear-gradient(90deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)`,
                  }}
                />
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[11px] font-semibold">
                <span className="tabular-nums">
                  {Math.min(goal.current, goal.target)}/{goal.target}
                </span>
                <span>{goal.unlocked ? "Fullført" : progressPct >= 75 ? "Nesten der" : "På vei"}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
