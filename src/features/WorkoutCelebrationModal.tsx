import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Award, Dumbbell, Layers, PartyPopper, Trophy, X } from "lucide-react";
import type { WorkoutCelebrationStats } from "../app/workoutCelebrationStats";

type WorkoutCelebrationModalProps = {
  open: boolean;
  programTitle: string;
  stats: WorkoutCelebrationStats;
  onClose: () => void;
};

function formatVolumeKg(value: number): string {
  return Math.round(value).toLocaleString("nb-NO");
}

export function WorkoutCelebrationModal({ open, programTitle, stats, onClose }: WorkoutCelebrationModalProps) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  const newRecordsCount = stats.newRecords.length;
  const hasNewRecords = newRecordsCount > 0;
  const headline = hasNewRecords ? "Ny rekord!" : "Økt fullført!";
  const subline = hasNewRecords
    ? newRecordsCount === 1
      ? `Du satte 1 ny personlig rekord i denne økta.`
      : `Du satte ${newRecordsCount} nye personlige rekorder i denne økta!`
    : "Bra jobba — du logget en hel økt i dag.";

  const statCells = [
    {
      key: "volume",
      label: "Totalt løftet",
      value: stats.totalVolumeKg > 0 ? `${formatVolumeKg(stats.totalVolumeKg)} kg` : "—",
      icon: <Dumbbell className="h-4 w-4" strokeWidth={2.25} aria-hidden />,
      tone: "pink" as const,
    },
    {
      key: "sets",
      label: "Sett",
      value: String(stats.completedSets),
      icon: <Layers className="h-4 w-4" strokeWidth={2.25} aria-hidden />,
      tone: "mint" as const,
    },
    {
      key: "exercises",
      label: "Øvelser",
      value: String(stats.uniqueExercises),
      icon: <Award className="h-4 w-4" strokeWidth={2.25} aria-hidden />,
      tone: "mint" as const,
    },
    {
      key: "records",
      label: newRecordsCount === 1 ? "Ny rekord" : "Nye rekorder",
      value: String(newRecordsCount),
      icon: <Trophy className="h-4 w-4" strokeWidth={2.25} aria-hidden />,
      tone: "pink" as const,
    },
  ];

  const modal = (
    <div className="motus-workout-celebration-backdrop" role="dialog" aria-modal="true" aria-labelledby="motus-workout-celebration-headline">
      <div className="motus-workout-celebration-card">
        <button
          type="button"
          className="motus-workout-celebration-close"
          onClick={onClose}
          aria-label="Lukk feiring"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>

        <div className="motus-workout-celebration-hero">
          <span className="motus-workout-celebration-emoji" aria-hidden>
            <PartyPopper className="h-10 w-10" strokeWidth={2} />
          </span>
          <p className="motus-workout-celebration-chip">Økt fullført</p>
          <h2 id="motus-workout-celebration-headline" className="motus-workout-celebration-headline">
            {headline}
          </h2>
          <p className="motus-workout-celebration-subline">{subline}</p>
          {programTitle ? <p className="motus-workout-celebration-program">{programTitle}</p> : null}
        </div>

        <div className="motus-workout-celebration-grid">
          {statCells.map((cell) => (
            <div key={cell.key} className={`motus-workout-celebration-stat motus-workout-celebration-stat--${cell.tone}`}>
              <span className={`motus-workout-celebration-stat-icon motus-workout-celebration-stat-icon--${cell.tone}`}>{cell.icon}</span>
              <p className="motus-workout-celebration-stat-value">{cell.value}</p>
              <p className="motus-workout-celebration-stat-label">{cell.label}</p>
            </div>
          ))}
        </div>

        {hasNewRecords ? (
          <div className="motus-workout-celebration-records">
            <p className="motus-workout-celebration-records-title">Nye rekorder</p>
            <ul className="motus-workout-celebration-records-list">
              {stats.newRecords.map((name) => (
                <li key={name} className="motus-workout-celebration-record-pill">
                  <Trophy className="h-3 w-3" strokeWidth={2.5} aria-hidden />
                  {name}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <button type="button" className="motus-workout-celebration-confirm" onClick={onClose}>
          Fortsett
        </button>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

export type { WorkoutCelebrationModalProps };
