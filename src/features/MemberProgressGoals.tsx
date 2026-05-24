import { Check, Circle, Flame } from "lucide-react";
import { MOTUS } from "../app/data";
import type { ProgressGoal } from "../app/memberProgressGamification";

const MOTUS_GRADIENT_90 = MOTUS.gradient;

type MemberProgressGoalsProps = {
  goals: ProgressGoal[];
  workingLevel: number;
  stepLabel: string;
  hasCompletedAllLevels: boolean;
  variant?: "default" | "flow";
};

function goalIcon(goal: ProgressGoal, index: number) {
  if (goal.unlocked) {
    return (
      <span className="motus-progress-goal-check motus-progress-goal-check--done" aria-hidden>
        <Check className="h-4 w-4" strokeWidth={3} />
      </span>
    );
  }
  if (goal.id.startsWith("streak") || goal.title.toLowerCase().includes("streak")) {
    return (
      <span className="motus-progress-goal-check motus-progress-goal-check--active" aria-hidden>
        <Flame className="h-4 w-4" strokeWidth={2.25} />
      </span>
    );
  }
  return (
    <span className="motus-progress-goal-check" aria-hidden>
      {index + 1}
    </span>
  );
}

export function MemberProgressGoals({
  goals,
  workingLevel,
  stepLabel,
  hasCompletedAllLevels,
  variant = "default",
}: MemberProgressGoalsProps) {
  const unlockedCount = goals.filter((goal) => goal.unlocked).length;
  const isFlow = variant === "flow";

  if (isFlow) {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="text-sm font-semibold text-slate-900">
              {hasCompletedAllLevels ? "Alle mål for dette steget er klart" : `Mål for steg ${workingLevel}`}
            </h4>
            <p className="mt-0.5 text-xs text-slate-500">
              {hasCompletedAllLevels
                ? "Fortsett jevn trening for å holde vanen."
                : `Fullfør alle tre punktene for å nå «${stepLabel}».`}
            </p>
          </div>
          {!hasCompletedAllLevels ? (
            <span className="motus-progress-goal-counter tabular-nums">
              {unlockedCount}/{goals.length}
            </span>
          ) : null}
        </div>
        <ol className="space-y-2">
          {goals.map((goal, index) => {
            const progressPct = Math.min(100, Math.round((Math.min(goal.current, goal.target) / goal.target) * 100));
            return (
              <li key={goal.id} className={`motus-progress-goal-row ${goal.unlocked ? "motus-progress-goal-row--done" : ""}`}>
                {goalIcon(goal, index)}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900">{goal.title}</div>
                      <p className="mt-0.5 text-xs leading-snug text-slate-500">{goal.description}</p>
                    </div>
                    <span className="shrink-0 text-xs font-bold tabular-nums text-slate-700">
                      {Math.min(goal.current, goal.target)}/{goal.target}
                    </span>
                  </div>
                  {!goal.unlocked ? (
                    <div className="motus-progress-track mt-2.5 h-1.5 rounded-full">
                      <div
                        className="motus-progress-fill h-1.5 rounded-full transition-all"
                        style={{
                          width: `${progressPct}%`,
                          background: MOTUS_GRADIENT_90,
                        }}
                      />
                    </div>
                  ) : null}
                </div>
                <span
                  className={`motus-progress-goal-status ${goal.unlocked ? "motus-progress-goal-status--done" : ""}`}
                  aria-hidden
                >
                  {goal.unlocked ? <Check className="h-4 w-4" strokeWidth={3} /> : <Circle className="h-4 w-4" strokeWidth={1.5} />}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    );
  }

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
          <span className="motus-progress-goal-counter tabular-nums">{unlockedCount}/{goals.length} klart</span>
        ) : null}
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {goals.map((goal, index) => {
          const progressPct = Math.min(100, Math.round((Math.min(goal.current, goal.target) / goal.target) * 100));
          return (
            <div key={goal.id} className={`motus-progress-goal-row ${goal.unlocked ? "motus-progress-goal-row--done" : ""}`}>
              {goalIcon(goal, index)}
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-slate-900">{goal.title}</div>
                <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{goal.description}</p>
                <div className="motus-progress-track mt-2.5 h-1.5 rounded-full">
                  <div
                    className="motus-progress-fill h-1.5 rounded-full transition-all"
                    style={{ width: `${progressPct}%`, background: MOTUS_GRADIENT_90 }}
                  />
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] font-semibold text-slate-600">
                  <span className="tabular-nums">
                    {Math.min(goal.current, goal.target)}/{goal.target}
                  </span>
                  <span>{goal.unlocked ? "Fullført" : progressPct >= 75 ? "Nesten der" : "På vei"}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
