import { Calendar, Dumbbell, Flame, Layers, Share2 } from "lucide-react";
import { GradientButton, StatusMessage } from "../app/ui";

type WeeklySummaryStats = {
  workouts: number;
  trainingDays: number;
  completedSets: number;
  volumeKg: number;
};

type MemberWeeklySummaryCardProps = {
  stats: WeeklySummaryStats;
  playfulLine: string;
  logoSrc: string;
  onShare: () => void;
  shareStatus: string | null;
};

export function MemberWeeklySummaryCard({ stats, onShare, shareStatus }: MemberWeeklySummaryCardProps) {
  const cells = [
    {
      key: "workouts",
      label: "Økter",
      value: String(stats.workouts),
      tone: "mint" as const,
      icon: <Calendar className="h-4 w-4" strokeWidth={2.25} aria-hidden />,
    },
    {
      key: "trainingDays",
      label: "Treningsdager",
      value: String(stats.trainingDays),
      tone: "pink" as const,
      icon: <Flame className="h-4 w-4" strokeWidth={2.25} aria-hidden />,
    },
    {
      key: "completedSets",
      label: "Sett",
      value: String(stats.completedSets),
      tone: "mint" as const,
      icon: <Layers className="h-4 w-4" strokeWidth={2.25} aria-hidden />,
    },
    {
      key: "volumeKg",
      label: "Totalt løftet",
      value: `${Math.round(stats.volumeKg).toLocaleString("nb-NO")} kg`,
      tone: "pink" as const,
      icon: <Dumbbell className="h-4 w-4" strokeWidth={2.25} aria-hidden />,
    },
  ];

  return (
    <section className="motus-progress-weekly-summary motus-progress-weekly-summary--minimal">
      <div className="motus-progress-weekly-summary-header">
        <div>
          <h3 className="motus-progress-weekly-summary-title">Ukesoppsummering</h3>
          <p className="motus-progress-weekly-summary-subline">Siste 7 dager</p>
        </div>
      </div>

      <div className="motus-progress-weekly-summary-grid">
        {cells.map((cell) => (
          <div key={cell.key} className={`motus-progress-weekly-stat motus-progress-weekly-stat--${cell.tone}`}>
            <span className={`motus-progress-weekly-stat-icon motus-progress-weekly-stat-icon--${cell.tone}`}>{cell.icon}</span>
            <div className="motus-progress-weekly-stat-value">{cell.value}</div>
            <div className="motus-progress-weekly-stat-label">{cell.label}</div>
          </div>
        ))}
      </div>

      <GradientButton type="button" onClick={onShare} className="motus-progress-weekly-summary-share">
        <Share2 className="h-4 w-4 shrink-0" aria-hidden />
        Last ned eller del bilde
      </GradientButton>

      {shareStatus ? (
        <StatusMessage
          message={shareStatus}
          tone={shareStatus.toLowerCase().includes("kunne ikke") ? "error" : "success"}
          className="motus-progress-weekly-summary-status"
        />
      ) : null}
    </section>
  );
}
