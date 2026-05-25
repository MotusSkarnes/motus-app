import { ArrowRight } from "lucide-react";

type MemberNextWorkoutCardProps = {
  title: string | null;
  subline?: string | null;
  source?: "plan" | "library" | "empty";
  programId?: string | null;
  onStart?: (programId: string) => void;
};

export function MemberNextWorkoutCard({ title, subline, source = "library", programId, onStart }: MemberNextWorkoutCardProps) {
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

  return (
    <section className="motus-progress-next-workout">
      <div className="motus-progress-next-workout-overlay" aria-hidden />
      <div className="motus-progress-next-workout-content">
        <span className="motus-progress-next-workout-chip">{chipLabel}</span>
        <h3 className="motus-progress-next-workout-title">{title}</h3>
        {subline ? <p className="motus-progress-next-workout-subline">{subline}</p> : null}
        {onStart && programId ? (
          <button
            type="button"
            className="motus-progress-next-workout-cta"
            onClick={() => onStart(programId)}
          >
            <span>Start økt</span>
            <ArrowRight className="h-4 w-4" strokeWidth={2.25} aria-hidden />
          </button>
        ) : null}
      </div>
    </section>
  );
}

export type { MemberNextWorkoutCardProps };
