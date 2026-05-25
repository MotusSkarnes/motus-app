import { ArrowRight } from "lucide-react";

type MemberNextWorkoutCardProps = {
  title: string | null;
  subline?: string | null;
  source?: "plan" | "library" | "empty";
  programId?: string | null;
  coverSrc?: string | null;
  journeyStep?: number | null;
  journeyStepLabel?: string | null;
  journeyNextStepLabel?: string | null;
  onStart?: (programId: string) => void;
};

export function MemberNextWorkoutCard({
  title,
  subline,
  source = "library",
  programId,
  coverSrc,
  journeyStep,
  journeyStepLabel,
  journeyNextStepLabel,
  onStart,
}: MemberNextWorkoutCardProps) {
  const isEmpty = source === "empty" || !title;

  if (isEmpty) {
    return (
      <section className="motus-progress-next-workout motus-progress-next-workout--empty">
        <div className="motus-progress-next-workout-content">
          <span className="motus-progress-next-workout-chip">Din neste økt</span>
          <h3 className="motus-progress-next-workout-title">Ingen økter planlagt i dag</h3>
          <p className="motus-progress-next-workout-subline">Legg til en periodeplan eller velg et program fra biblioteket.</p>
        </div>
      </section>
    );
  }

  const chipLabel = source === "plan" ? "Dagens plan" : "Din neste økt";
  const journeyText = journeyStepLabel
    ? journeyNextStepLabel
      ? `Du er på «${journeyStepLabel}». Neste: «${journeyNextStepLabel}».`
      : `Du er på «${journeyStepLabel}».`
    : null;

  return (
    <section className="motus-progress-next-workout">
      {coverSrc ? (
        <img
          src={coverSrc}
          alt=""
          className="motus-progress-next-workout-image"
          loading="lazy"
          aria-hidden
        />
      ) : null}
      <div className="motus-progress-next-workout-overlay" aria-hidden />
      <div className="motus-progress-next-workout-content">
        <span className="motus-progress-next-workout-chip">{chipLabel}</span>
        <h3 className="motus-progress-next-workout-title">{title}</h3>
        {subline ? <p className="motus-progress-next-workout-subline">{subline}</p> : null}
        {journeyStep && journeyStepLabel ? (
          <div className="motus-progress-next-workout-journey">
            <span className="motus-progress-next-workout-journey-step">{journeyStep}</span>
            <div className="motus-progress-next-workout-journey-text">
              <p className="motus-progress-next-workout-journey-label">{journeyStepLabel}</p>
              {journeyText ? <p className="motus-progress-next-workout-journey-subline">{journeyText}</p> : null}
            </div>
          </div>
        ) : null}
        {onStart && programId ? (
          <button
            type="button"
            className="motus-progress-next-workout-cta"
            onClick={() => onStart(programId)}
          >
            <span>{journeyStep ? `Fortsett steg ${journeyStep}` : "Start økt"}</span>
            <ArrowRight className="h-4 w-4" strokeWidth={2.25} aria-hidden />
          </button>
        ) : null}
      </div>
    </section>
  );
}

export type { MemberNextWorkoutCardProps };
