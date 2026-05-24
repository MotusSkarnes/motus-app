import { ArrowRight } from "lucide-react";
import { PROGRESS_FLOW_IMAGE } from "../app/progressImagery";
import { imageObjectPositionFromSrc } from "../app/imageFocalPoint";
import { PROGRESS_STEP_LABELS } from "../app/memberProgressGamification";
import type { ProgressGoal, RecentStreakWeek } from "../app/memberProgressGamification";
import { MemberProgressGoals } from "./MemberProgressGoals";
import { MemberWeeklyStreakCard } from "./MemberWeeklyStreakCard";
import { GradientButton } from "../app/ui";

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
  onContinue?: () => void;
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
  onContinue,
}: MemberTrainingFlowCardProps) {
  const activeStep = hasCompletedAllLevels ? achievementMaxLevel : achievementLevel;
  const activeStepLabel = PROGRESS_STEP_LABELS[activeStep - 1] ?? stepLabel;

  return (
    <div className="motus-progress-flow-card" aria-labelledby="member-training-flow-heading">
      <div className="motus-progress-flow-cinematic">
        <img
          src={PROGRESS_FLOW_IMAGE}
          alt=""
          className="motus-progress-flow-cinematic-bg"
          loading="lazy"
          style={{ objectPosition: imageObjectPositionFromSrc(PROGRESS_FLOW_IMAGE) }}
        />
        <div className="motus-progress-flow-cinematic-overlay" aria-hidden />
        <div className="motus-progress-flow-cinematic-content">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-white/75">Din treningsflyt</p>
          <h3 id="member-training-flow-heading" className="mt-1 text-2xl font-black tracking-tight text-white sm:text-3xl">
            {hasCompletedAllLevels ? (
              <>Alle {achievementMaxLevel} steg fullført</>
            ) : (
              <>
                <span className="text-white/90">{activeStep}</span> {activeStepLabel}
              </>
            )}
          </h3>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-white/85">
            {hasCompletedAllLevels
              ? "Fantastisk kontinuitet — hold vanen levende."
              : nextStepLabel
                ? `Du er på «${stepLabel}». Neste: «${nextStepLabel}».`
                : `Du er på «${stepLabel}».`}
          </p>
          {!hasCompletedAllLevels && onContinue ? (
            <GradientButton type="button" onClick={onContinue} className="mt-4 gap-2 shadow-lg">
              Fortsett steg {activeStep}
              <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
            </GradientButton>
          ) : null}
        </div>
      </div>

      <div className="px-4 py-4 sm:px-5">
        <div className="mb-2 flex items-center justify-between gap-2 text-[11px] font-medium text-slate-500">
          <span>Din reise</span>
          <span className="shrink-0 tabular-nums text-slate-600">
            {achievedLevel} fullført · {hasCompletedAllLevels ? "mål nådd" : `mot steg ${activeStep}`}
          </span>
        </div>
        <ol className="motus-progress-flow-steps scrollbar-none" aria-label="Steg i treningsflyten">
          {PROGRESS_STEP_LABELS.map((label, index) => {
            const step = index + 1;
            const completed = step <= achievedLevel;
            const current = !hasCompletedAllLevels && step === activeStep;
            const upcoming = step > achievedLevel && !current;
            return (
              <li key={label} className="flex shrink-0 items-start">
                <div className="flex w-[3.75rem] flex-col items-center gap-2 sm:w-[4.5rem]">
                  <span
                    title={`Steg ${step}: ${label}`}
                    className={`motus-progress-flow-step ${
                      completed
                        ? "motus-progress-flow-step--completed"
                        : current
                          ? "motus-progress-flow-step--current motus-soft-pulse"
                          : "motus-progress-flow-step--upcoming"
                    }`}
                  >
                    {completed ? "✓" : step}
                  </span>
                  <span
                    className={`hidden h-9 w-full px-0.5 text-center text-[9px] font-medium leading-[1.15] sm:line-clamp-2 sm:block ${
                      current ? "font-semibold text-slate-800" : completed ? "text-slate-600" : upcoming ? "text-slate-400" : "text-slate-500"
                    }`}
                  >
                    {label}
                  </span>
                </div>
                {step < achievementMaxLevel ? (
                  <span
                    className={`motus-progress-flow-connector mt-[1.15rem] ${step < achievedLevel || (step === achievedLevel && current) ? "motus-progress-flow-connector--active" : ""}`}
                    aria-hidden
                  />
                ) : null}
              </li>
            );
          })}
        </ol>
      </div>

      <div className="space-y-4 border-t border-slate-100 px-4 py-4 sm:px-5 sm:py-5">
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
  );
}
