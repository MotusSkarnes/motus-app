import { ArrowRight } from "lucide-react";
import type { TrainingProgram } from "../app/types";

type MemberNextWorkoutCardProps = {
  program: TrainingProgram | null;
  onStart?: (programId: string) => void;
};

export function MemberNextWorkoutCard({ program, onStart }: MemberNextWorkoutCardProps) {
  if (!program) {
    return (
      <section className="motus-progress-next-workout motus-progress-next-workout--empty">
        <div className="motus-progress-next-workout-content">
          <span className="motus-progress-next-workout-chip">Din neste økt</span>
          <h3 className="motus-progress-next-workout-title">Ingen økter klare</h3>
          <p className="motus-progress-next-workout-subline">Be PT-en din lage et nytt program, eller velg et fra inspirasjonen.</p>
        </div>
      </section>
    );
  }

  const subline = program.goal?.trim() || program.notes?.trim() || "Klar når du er.";

  return (
    <section className="motus-progress-next-workout">
      <div className="motus-progress-next-workout-overlay" aria-hidden />
      <div className="motus-progress-next-workout-content">
        <span className="motus-progress-next-workout-chip">Din neste økt</span>
        <h3 className="motus-progress-next-workout-title">{program.title}</h3>
        <p className="motus-progress-next-workout-subline">{subline}</p>
        {onStart ? (
          <button
            type="button"
            className="motus-progress-next-workout-cta"
            onClick={() => onStart(program.id)}
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
