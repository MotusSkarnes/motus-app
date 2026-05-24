import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import type { ScoreTrend } from "../app/memberMomentumScores";
import { PROGRESS_HERO_IMAGE } from "../app/progressImagery";
import type { MemberProgressScores } from "../app/memberMomentumScores";
import { imageObjectPositionFromSrc } from "../app/imageFocalPoint";

type MemberProgressHeroCardProps = {
  scores: MemberProgressScores;
  consecutiveTrainingDays: number;
  streakWeeks: number;
  memberFirstName?: string;
};

function momentumTrendLabel(trend: ScoreTrend): string {
  if (trend === "up") return "Opp fra forrige uke";
  if (trend === "down") return "Under forrige uke";
  return "Jevn uke";
}

function MomentumTrendIcon({ trend }: { trend: ScoreTrend }) {
  if (trend === "up") return <ArrowUpRight className="h-5 w-5 text-white" aria-hidden />;
  if (trend === "down") return <ArrowDownRight className="h-5 w-5 text-white" aria-hidden />;
  return <ArrowRight className="h-5 w-5 text-white/80" aria-hidden />;
}

function HeroMomentumChart({ points, trend }: { points: number[]; trend: ScoreTrend }) {
  if (!points.length) return null;
  const max = Math.max(...points, 1);
  const width = 320;
  const height = 72;
  const polylinePoints = points
    .map((value, index) => {
      const x = points.length === 1 ? width / 2 : (index / (points.length - 1)) * (width - 16) + 8;
      const y = height - 10 - (value / max) * (height - 18);
      return `${x},${y}`;
    })
    .join(" ");
  const stroke = trend === "down" ? "rgba(255,255,255,0.75)" : "#30e3be";

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="motus-progress-v2-hero-chart" aria-hidden preserveAspectRatio="none">
      <defs>
        <linearGradient id="motus-progress-hero-chart-glow" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#30e3be" />
          <stop offset="100%" stopColor="#d91278" />
        </linearGradient>
      </defs>
      <polyline
        fill="none"
        stroke="url(#motus-progress-hero-chart-glow)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={polylinePoints}
      />
      {points.map((value, index) => {
        const x = points.length === 1 ? width / 2 : (index / (points.length - 1)) * (width - 16) + 8;
        const y = height - 10 - (value / max) * (height - 18);
        return <circle key={`${index}-${value}`} cx={x} cy={y} r="3.5" fill={stroke === "#30e3be" ? "#d91278" : "#fff"} />;
      })}
    </svg>
  );
}

export function MemberProgressHeroCard({ scores, consecutiveTrainingDays, streakWeeks }: MemberProgressHeroCardProps) {
  const { momentum, xp } = scores;
  const streakDots = Math.min(8, Math.max(consecutiveTrainingDays, streakWeeks > 0 ? 1 : 0, 1));

  return (
    <section className="motus-progress-v2-hero motus-fade-in-up" aria-label="Momentum og fremgang">
      <p className="motus-progress-v2-hero-badge">
        Nivå {xp.level} · {xp.levelLabel}
      </p>

      <div className="motus-progress-v2-hero-top">
        <div className="motus-progress-v2-hero-main">
          <p className="motus-progress-v2-hero-kicker">Momentum</p>
          <div className="motus-progress-v2-hero-momentum-row">
            <span className="motus-progress-v2-hero-momentum-value">{momentum.pct}%</span>
            <MomentumTrendIcon trend={momentum.trend} />
          </div>
          <p className="motus-progress-v2-hero-subline">{momentum.subline || momentumTrendLabel(momentum.trend)} 🔥</p>
        </div>

        <div className="motus-progress-v2-hero-portrait motus-image-frame">
          <img
            src={PROGRESS_HERO_IMAGE}
            alt=""
            className="motus-image-media"
            loading="lazy"
            style={{ objectPosition: imageObjectPositionFromSrc(PROGRESS_HERO_IMAGE) }}
          />
        </div>
      </div>

      {consecutiveTrainingDays > 0 ? (
        <div className="motus-progress-v2-hero-streak-row">
          <span className="motus-progress-v2-hero-streak-label">
            {consecutiveTrainingDays} {consecutiveTrainingDays === 1 ? "økt" : "økter"} på rad
          </span>
          <div className="motus-progress-v2-hero-streak-dots" aria-hidden>
            {Array.from({ length: streakDots }).map((_, index) => (
              <span key={index} className={index < consecutiveTrainingDays ? "is-active" : ""} />
            ))}
          </div>
        </div>
      ) : null}

      <HeroMomentumChart points={momentum.sparkPoints} trend={momentum.trend} />

      <div className="motus-progress-v2-hero-xp">
        <div className="motus-progress-v2-hero-xp-labels">
          <span>{xp.totalXp.toLocaleString("nb-NO")} XP</span>
          <span>
            {xp.xpInLevel}/{xp.xpForNextLevel}
          </span>
        </div>
        <div className="motus-progress-v2-hero-xp-track">
          <div className="motus-progress-v2-hero-xp-fill" style={{ width: `${xp.pctToNext}%` }} />
        </div>
      </div>
    </section>
  );
}

export type { MemberProgressHeroCardProps };
