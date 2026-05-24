import { Route } from "lucide-react";
import { MOTUS } from "../app/data";
import { PROGRESS_FLOW_IMAGE } from "../app/progressImagery";
import { imageObjectPositionFromSrc } from "../app/imageFocalPoint";
import { PROGRESS_STEP_LABELS } from "../app/memberProgressGamification";
import type { ProgressGoal, RecentStreakWeek } from "../app/memberProgressGamification";
import { MemberProgressGoals } from "./MemberProgressGoals";
import { MemberWeeklyStreakCard } from "./MemberWeeklyStreakCard";

const MOTUS_GRADIENT = `${MOTUS.gradient}`;
const MOTUS_GRADIENT_90 = MOTUS.gradient;

type MemberTrainingFlowCardProps = {
  achievementLevel: number;
  achievementMaxLevel: number;
  achievedLevel: number;
  hasCompletedAllLevels: boolean;
  stepLabel: string;
  nextStepLabel: string | null;
  goals: ProgressGoal[];
  streakWeeks: number;
  streakSubline: string;
  recentStreakWeeks: RecentStreakWeek[];
  currentStreakMilestoneTarget: number;
};

export function MemberTrainingFlowCard({
  achievementLevel,
  achievementMaxLevel,
  achievedLevel,
  hasCompletedAllLevels,
  stepLabel,
  nextStepLabel,
  goals,
  streakWeeks,
  streakSubline,
  recentStreakWeeks,
  currentStreakMilestoneTarget,
}: MemberTrainingFlowCardProps) {
  const activeStep = hasCompletedAllLevels ? achievementMaxLevel : achievementLevel;

  return (
    <div className="motus-progress-flow-card" aria-labelledby="member-training-flow-heading">
      <div className="motus-progress-flow-layout">
        <div className="motus-progress-flow-media motus-image-frame motus-image-frame--portrait hidden sm:block">
          <img
            src={PROGRESS_FLOW_IMAGE}
            alt=""
            className="motus-image-media"
            loading="lazy"
            style={{ objectPosition: imageObjectPositionFromSrc(PROGRESS_FLOW_IMAGE) }}
          />
          <div className="motus-progress-flow-media-fade" aria-hidden />
        </div>

        <div className="min-w-0 flex-1">
      <div className="border-b border-slate-100 px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-start gap-3">
          <span
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F3F5F7] text-teal-600"
            aria-hidden
          >
            <Route className="h-5 w-5" strokeWidth={2.25} />
          </span>
          <div className="min-w-0 flex-1">
            <h3 id="member-training-flow-heading" className="text-base font-bold tracking-tight text-slate-900">
              Din treningsflyt
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              {hasCompletedAllLevels
                ? `Du har fullført alle ${achievementMaxLevel} steg — fantastisk kontinuitet.`
                : nextStepLabel
                  ? `Du er på «${stepLabel}». Neste steg blir «${nextStepLabel}».`
                  : `Du er på «${stepLabel}».`}
            </p>
          </div>
          <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold tabular-nums text-slate-700">
            {hasCompletedAllLevels ? "Alle steg fullført" : `Steg ${activeStep} / ${achievementMaxLevel}`}
          </span>
        </div>

        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between gap-2 text-[11px] font-medium text-slate-500">
            <span>Din reise</span>
            <span className="shrink-0 tabular-nums text-slate-600">
              {achievedLevel} fullført · {hasCompletedAllLevels ? "mål nådd" : `mot steg ${activeStep}`}
            </span>
          </div>
          <ol
            className="-mx-1 flex items-start gap-0 overflow-x-auto px-1 pb-1 scrollbar-none sm:mx-0 sm:px-0"
            aria-label="Steg i treningsflyten"
          >
            {PROGRESS_STEP_LABELS.map((label, index) => {
              const step = index + 1;
              const completed = step <= achievedLevel;
              const current = !hasCompletedAllLevels && step === activeStep;
              const upcoming = step > achievedLevel && !current;
              return (
                <li key={label} className="flex shrink-0 items-start">
                  <div className="flex w-[3.1rem] flex-col items-center gap-1.5 sm:w-[3.75rem]">
                    <span
                      title={`Steg ${step}: ${label}`}
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-bold tabular-nums transition ${
                        completed
                          ? "border-transparent text-white"
                          : current
                            ? "motus-soft-pulse border-transparent bg-white text-slate-800 ring-2 ring-pink-200/80 ring-offset-1"
                            : "border-slate-200 bg-white text-slate-400"
                      }`}
                      style={
                        completed
                          ? { background: MOTUS_GRADIENT }
                          : current
                            ? { boxShadow: `inset 0 0 0 2px ${MOTUS.turquoise}` }
                            : undefined
                      }
                    >
                      {completed ? "✓" : step}
                    </span>
                    <span
                      className={`hidden h-8 w-full px-0.5 text-center text-[9px] font-medium leading-[1.15] sm:line-clamp-2 sm:block ${
                        current ? "font-semibold text-slate-800" : completed ? "text-slate-600" : upcoming ? "text-slate-400" : "text-slate-500"
                      }`}
                    >
                      {label}
                    </span>
                  </div>
                  {step < achievementMaxLevel ? (
                    <span
                      className={`mt-[0.85rem] h-0.5 w-2 shrink-0 rounded-full sm:w-2.5 ${step < achievedLevel || (step === achievedLevel && current) ? "" : "bg-slate-200"}`}
                      style={
                        step < achievedLevel
                          ? { background: MOTUS_GRADIENT_90, opacity: 0.85 }
                          : step === achievedLevel && current
                            ? { background: `linear-gradient(90deg, ${MOTUS.turquoise}55 0%, ${MOTUS.pink}55 100%)` }
                            : undefined
                      }
                      aria-hidden
                    />
                  ) : null}
                </li>
              );
            })}
          </ol>
          <p className="mt-2 text-center text-xs font-medium leading-snug text-slate-700 sm:hidden">
            {hasCompletedAllLevels
              ? "Alle steg fullført"
              : `Steg ${activeStep}: ${PROGRESS_STEP_LABELS[activeStep - 1]}`}
          </p>
        </div>
      </div>

      <div className="space-y-4 px-4 py-4 sm:px-5 sm:py-5">
        <MemberWeeklyStreakCard
          variant="flow"
          streakWeeks={streakWeeks}
          streakSubline={streakSubline}
          recentStreakWeeks={recentStreakWeeks}
          currentStreakMilestoneTarget={currentStreakMilestoneTarget}
        />
        <MemberProgressGoals
          variant="flow"
          goals={goals}
          workingLevel={achievementLevel}
          stepLabel={stepLabel}
          hasCompletedAllLevels={hasCompletedAllLevels}
        />
      </div>
        </div>
      </div>
    </div>
  );
}
