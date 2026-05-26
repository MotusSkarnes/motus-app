import { ArrowRight, BarChart3, CalendarDays, Dumbbell, Hash, Share2, Sparkles } from "lucide-react";
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

const HERO_IMAGE_SRC = "/share/weekly-summary-hero.png";

export function MemberWeeklySummaryCard({ stats, logoSrc, onShare, shareStatus }: MemberWeeklySummaryCardProps) {
  const cells = [
    {
      key: "workouts",
      label: "Økter",
      value: String(stats.workouts),
      icon: <Hash className="h-4 w-4" strokeWidth={2.25} aria-hidden />,
    },
    {
      key: "trainingDays",
      label: "Treningsdager",
      value: String(stats.trainingDays),
      icon: <CalendarDays className="h-4 w-4" strokeWidth={2.25} aria-hidden />,
    },
    {
      key: "completedSets",
      label: "Sett",
      value: String(stats.completedSets),
      icon: <BarChart3 className="h-4 w-4" strokeWidth={2.25} aria-hidden />,
    },
    {
      key: "volumeKg",
      label: "Totalt løftet",
      value: `${Math.round(stats.volumeKg).toLocaleString("nb-NO")} kg`,
      icon: <Dumbbell className="h-4 w-4" strokeWidth={2.25} aria-hidden />,
    },
  ];

  return (
    <section className="motus-weekly-summary" aria-label="Ukesoppsummering">
      <div className="motus-weekly-summary-photo">
        <img src={HERO_IMAGE_SRC} alt="" loading="lazy" decoding="async" />
      </div>
      <div className="motus-weekly-summary-content">
        <img src={logoSrc} alt="Motus" className="motus-weekly-summary-brand" />
        <div className="motus-weekly-summary-eyebrow">
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          <span>UKESOPPSUMMERING</span>
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
        </div>
        <p className="motus-weekly-summary-sub">Siste 7 dager — delbart kort med tall og løftefakta.</p>

        <ul className="motus-weekly-summary-stats">
          {cells.map((cell) => (
            <li key={cell.key}>
              <span className="motus-weekly-summary-stat-icon">{cell.icon}</span>
              <div className="motus-weekly-summary-stat-text">
                <div className="motus-weekly-summary-stat-value">{cell.value}</div>
                <div className="motus-weekly-summary-stat-label">{cell.label}</div>
              </div>
            </li>
          ))}
        </ul>

        <GradientButton type="button" onClick={onShare} className="motus-weekly-summary-cta">
          <Share2 className="h-4 w-4 shrink-0" aria-hidden />
          <span>Last ned eller del bilde</span>
          <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
        </GradientButton>

        <p className="motus-weekly-summary-caption">Bildet kan lagres eller deles videre fra galleriet.</p>

        {shareStatus ? (
          <StatusMessage
            message={shareStatus}
            tone={shareStatus.toLowerCase().includes("kunne ikke") ? "error" : "success"}
            className="motus-weekly-summary-status"
          />
        ) : null}
      </div>
    </section>
  );
}
