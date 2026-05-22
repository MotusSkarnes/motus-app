import { Check, Circle } from "lucide-react";
import { MOTUS } from "../app/data";
import type { ProgressGoal } from "../app/memberProgressGamification";

type MemberProgressGoalsProps = {
  goals: ProgressGoal[];
  workingLevel: number;
  stepLabel: string;
  hasCompletedAllLevels: boolean;
  variant?: "default" | "flow";
};

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
                : `Fullfør alle tre punktene under for å nå «${stepLabel}».`}
            </p>
          </div>
          {!hasCompletedAllLevels ? (
            <span className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold tabular-nums text-slate-700">
              {unlockedCount}/{goals.length}
            </span>
          ) : null}
        </div>
        <ol className="space-y-0">
          {goals.map((goal, index) => {
            const progressPct = Math.min(100, Math.round((Math.min(goal.current, goal.target) / goal.target) * 100));
            const isLast = index === goals.length - 1;
            return (
              <li key={goal.id} className="relative flex gap-3 pb-4 last:pb-0">
                {!isLast ? <span className="absolute left-[0.95rem] top-8 bottom-0 w-px bg-slate-200" aria-hidden /> : null}
                <span
                  className={`relative z-[1] flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold ${
                    goal.unlocked ? "border-transparent text-white" : "border-slate-200 bg-white text-slate-500"
                  }`}
                  style={goal.unlocked ? { background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` } : undefined}
                  aria-hidden
                >
                  {goal.unlocked ? <Check className="h-4 w-4" strokeWidth={3} /> : index + 1}
                </span>
                <div className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900">{goal.title}</div>
                      <p className="mt-0.5 text-xs leading-snug text-slate-500">{goal.description}</p>
                    </div>
                    <span className="shrink-0 text-[11px] font-semibold tabular-nums text-slate-600">
                      {Math.min(goal.current, goal.target)}/{goal.target}
                    </span>
                  </div>
                  <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
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
                  <p className="mt-1.5 text-[11px] font-medium text-slate-500">
                    {goal.unlocked ? "Fullført" : progressPct >= 75 ? "Nesten der" : "På vei"}
                  </p>
                </div>
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
                <span
                  className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${
                    goal.unlocked ? "border-emerald-200 bg-emerald-100 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-400"
                  }`}
                  aria-hidden
                >
                  {goal.unlocked ? <Check className="h-4 w-4" strokeWidth={3} /> : <Circle className="h-3.5 w-3.5" />}
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
