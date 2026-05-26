import {
  ArrowRight,
  Clock,
  Dumbbell,
  Flame,
  Footprints,
  Share2,
  Trophy,
  Users,
} from "lucide-react";
import { StatusMessage } from "../app/ui";

type WeeklySummaryStats = {
  workouts: number;
  strengthWorkouts?: number;
  groupClasses?: number;
  trainingDays: number;
  completedSets: number;
  volumeKg: number;
  kcal?: number;
  activityMinutes?: number;
};

type MemberWeeklySummaryCardProps = {
  stats: WeeklySummaryStats;
  /** Beholdes for kompatibilitet — vises ikke i ny design. */
  playfulLine?: string;
  logoSrc: string;
  weekLabel: string;
  title: string;
  seierText: string;
  formatActivityTime: (minutes: number) => string;
  onShare: () => void;
  shareStatus: string | null;
};

const HERO_IMAGE_SRC = "/share/weekly-summary-hero.png";

function fmtNumber(value: number): string {
  return Math.round(value).toLocaleString("nb-NO");
}

export function MemberWeeklySummaryCard({
  stats,
  logoSrc,
  weekLabel,
  title,
  seierText,
  formatActivityTime,
  onShare,
  shareStatus,
}: MemberWeeklySummaryCardProps) {
  const strengthCount = stats.strengthWorkouts ?? Math.max(0, stats.workouts - (stats.groupClasses ?? 0));
  const groupCount = stats.groupClasses ?? 0;
  const kcal = stats.kcal ?? Math.round(strengthCount * 350 + groupCount * 450);
  const minutes = stats.activityMinutes ?? strengthCount * 45 + groupCount * 60;

  const tiles = [
    {
      key: "kg",
      icon: <Dumbbell className="h-4 w-4" strokeWidth={2.25} aria-hidden />,
      iconTone: "teal" as const,
      value: fmtNumber(stats.volumeKg),
      label: "Kg løftet",
      sub: "Totalt løftet denne uken",
      labelTone: "teal" as const,
    },
    {
      key: "workouts",
      icon: <Footprints className="h-4 w-4" strokeWidth={2.25} aria-hidden />,
      iconTone: "pink" as const,
      value: String(stats.workouts),
      label: "Treningsøkter",
      sub: "Jeg har vært skikkelig på!",
      labelTone: "pink" as const,
    },
    {
      key: "groups",
      icon: <Users className="h-4 w-4" strokeWidth={2.25} aria-hidden />,
      iconTone: "teal" as const,
      value: String(groupCount),
      label: "Gruppetimer",
      sub: groupCount > 0 ? "Bygger fellesskap!" : "Bli med i en time!",
      labelTone: "teal" as const,
    },
    {
      key: "kcal",
      icon: <Flame className="h-4 w-4" strokeWidth={2.25} aria-hidden />,
      iconTone: "pink" as const,
      value: fmtNumber(kcal),
      label: "Kcal forbrukt",
      sub: "Energi brukt på å bli sterkere",
      labelTone: "pink" as const,
    },
    {
      key: "time",
      icon: <Clock className="h-4 w-4" strokeWidth={2.25} aria-hidden />,
      iconTone: "teal" as const,
      value: formatActivityTime(minutes),
      label: "Aktivitetstid",
      sub: "Tid investert i meg selv",
      labelTone: "teal" as const,
    },
  ];

  return (
    <div className="motus-weekly-share-wrap">
      <article className="motus-weekly-share-card" aria-label="Ukesoppsummering — delbart kort">
        <div className="motus-weekly-share-photo" aria-hidden>
          <img src={HERO_IMAGE_SRC} alt="" loading="lazy" decoding="async" />
          <div className="motus-weekly-share-photo-overlay" />
          <blockquote className="motus-weekly-share-quote">
            <span className="motus-weekly-share-quote-mark">&ldquo;</span>
            Fremgang skjer én uke av gangen. Jeg bygger sterke vaner!
            <span className="motus-weekly-share-quote-mark motus-weekly-share-quote-mark--end">&rdquo;</span>
          </blockquote>
        </div>

        <header className="motus-weekly-share-header">
          <img src={logoSrc} alt="Motus" className="motus-weekly-share-logo" />
          <span className="motus-weekly-share-week-pill">{weekLabel}</span>
        </header>

        <div className="motus-weekly-share-body">
          <span className="motus-weekly-share-eyebrow">Uken som har vært</span>
          <h2 className="motus-weekly-share-title">
            <span className="motus-weekly-share-title-text">{title}</span>
          </h2>
          <p className="motus-weekly-share-sub">
            Se hva jeg har fått til på Motus.
            <br />
            Små steg hver uke gir store resultater!
          </p>

          <ul className="motus-weekly-share-stats">
            {tiles.map((tile) => (
              <li key={tile.key} className="motus-weekly-share-stat">
                <span className={`motus-weekly-share-stat-icon motus-weekly-share-stat-icon--${tile.iconTone}`}>
                  {tile.icon}
                </span>
                <span className="motus-weekly-share-stat-value">{tile.value}</span>
                <span className={`motus-weekly-share-stat-label motus-weekly-share-stat-label--${tile.labelTone}`}>
                  {tile.label}
                </span>
                <span className="motus-weekly-share-stat-sub">{tile.sub}</span>
              </li>
            ))}
          </ul>
        </div>

        <footer className="motus-weekly-share-footer">
          <span className="motus-weekly-share-trophy">
            <Trophy className="h-5 w-5" strokeWidth={2.25} aria-hidden />
          </span>
          <div className="motus-weekly-share-seier">
            <span className="motus-weekly-share-seier-label">Ukens seier</span>
            <span className="motus-weekly-share-seier-text">{seierText}</span>
          </div>
          <img src={logoSrc} alt="" aria-hidden className="motus-weekly-share-footer-logo" />
        </footer>
      </article>

      <button type="button" className="motus-weekly-share-cta" onClick={onShare}>
        <span className="motus-weekly-share-cta-icon">
          <Share2 className="h-5 w-5" strokeWidth={2.25} aria-hidden />
        </span>
        <span className="motus-weekly-share-cta-text">
          <span className="motus-weekly-share-cta-title">Del kortet ditt</span>
          <span className="motus-weekly-share-cta-sub">Inspirer andre og spre treningsglede!</span>
        </span>
        <ArrowRight className="h-4 w-4 motus-weekly-share-cta-arrow" aria-hidden />
      </button>

      {shareStatus ? (
        <StatusMessage
          message={shareStatus}
          tone={shareStatus.toLowerCase().includes("kunne ikke") ? "error" : "success"}
          className="motus-weekly-share-status"
        />
      ) : null}
    </div>
  );
}
