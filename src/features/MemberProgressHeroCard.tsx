import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Flame, Shield, Target, Trophy } from "lucide-react";
import { MOTUS } from "../app/data";
import type { MemberProgressScores } from "../app/memberMomentumScores";
import type { RecentStreakWeek } from "../app/memberProgressGamification";

type MemberProgressHeroCardProps = {
  scores: MemberProgressScores;
  memberFirstName: string;
  streakWeeks: number;
  recentStreakWeeks?: RecentStreakWeek[];
  personalRecordsCount?: number;
  /** Brukes til "Slik fungerer XP"-forklaringen så vi kan vise medlemmets faktiske tall. */
  xpBreakdown?: {
    completedSessions: number;
    streakWeeks: number;
    achievedLevel: number;
  };
};

const XP_PER_SESSION = 100;
const XP_PER_STREAK_WEEK = 75;
const XP_PER_ACHIEVED_LEVEL = 250;

function computeBestStreakWeeks(weeks: RecentStreakWeek[] = []): number {
  let best = 0;
  let current = 0;
  for (const week of weeks) {
    if (week.trained) {
      current += 1;
      if (current > best) best = current;
    } else {
      current = 0;
    }
  }
  return best;
}

function bestStreakSubline(streakWeeks: number, bestStreakWeeks: number): string {
  if (bestStreakWeeks <= 0) return "Din første streak er i gang.";
  if (streakWeeks >= bestStreakWeeks) return "Ny personlig rekord.";
  return `Din beste: ${bestStreakWeeks} uker`;
}

function personalRecordSubline(count: number): string {
  if (count <= 0) return "Logg styrkeøkter for å bygge PR-listen.";
  if (count === 1) return "Din første personlige rekord er satt.";
  return "Personlige rekorder registrert.";
}

function useCountUpNumber(target: number, durationMs = 800): number {
  const [value, setValue] = useState(target);
  const startRef = useRef<{ from: number; to: number; startTs: number } | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
    }
    startRef.current = { from: value, to: target, startTs: performance.now() };
    const tick = (now: number) => {
      const start = startRef.current;
      if (!start) return;
      const progress = Math.min(1, (now - start.startTs) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = Math.round(start.from + (start.to - start.from) * eased);
      setValue(next);
      if (progress < 1) {
        rafRef.current = window.requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
      }
    };
    rafRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, durationMs]);

  return value;
}

function MomentumRing({ pct, animatedPct }: { pct: number; animatedPct: number }) {
  const gradientId = useId();
  const filterId = `${gradientId}-glow`;
  const radius = 64;
  const stroke = 14;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, animatedPct));
  const dashOffset = circumference - (circumference * clamped) / 100;
  const angle = (clamped / 100) * 360 - 90;
  const headX = 80 + radius * Math.cos((angle * Math.PI) / 180);
  const headY = 80 + radius * Math.sin((angle * Math.PI) / 180);

  return (
    <div className="motus-progress-momentum-ring" aria-label={`Flyt ${pct} prosent`}>
      <svg viewBox="0 0 160 160" className="motus-progress-momentum-ring-svg">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#30e3be" />
            <stop offset="55%" stopColor="#ff6bbb" />
            <stop offset="100%" stopColor="#d91278" />
          </linearGradient>
          <filter id={filterId} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <circle cx="80" cy="80" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
        <circle
          cx="80"
          cy="80"
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform="rotate(-90 80 80)"
          filter={`url(#${filterId})`}
          className="motus-progress-momentum-ring-fill"
        />
        {clamped > 4 ? (
          <>
            <circle cx={headX} cy={headY} r="9" fill="#ffffff" opacity="0.18" />
            <circle cx={headX} cy={headY} r="5.5" fill="#ffffff" className="motus-progress-momentum-ring-head" />
          </>
        ) : null}
      </svg>
    </div>
  );
}

function ScoreRing({
  label,
  value,
  subline,
  pct,
  tone = "mint",
}: {
  label: string;
  value: string;
  subline: string;
  pct: number | null;
  tone?: "mint" | "pink";
}) {
  const ringPct = pct === null ? 0 : Math.min(100, Math.max(0, pct));
  const stroke = tone === "pink" ? MOTUS.pink : MOTUS.turquoise;
  const dash = `${Math.max(8, (ringPct / 100) * 226)} 226`;

  return (
    <div className="motus-progress-status-card">
      <div className="relative mx-auto motus-progress-status-ring">
        <svg viewBox="0 0 88 88" className="h-full w-full" aria-hidden>
          <circle cx="44" cy="44" r="36" fill="none" stroke="rgba(15,23,42,0.08)" strokeWidth="6" />
          {pct !== null ? (
            <circle
              cx="44"
              cy="44"
              r="36"
              fill="none"
              stroke={stroke}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={dash}
              transform="rotate(-90 44 44)"
            />
          ) : null}
        </svg>
        <div className="motus-progress-status-value absolute inset-0 flex items-center justify-center font-bold tabular-nums text-slate-900">
          {value}
        </div>
      </div>
      <p className="motus-progress-status-label mt-1 font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="motus-progress-status-subline mt-0.5 line-clamp-2 text-slate-600">{subline}</p>
    </div>
  );
}

function StatHighlight({
  label,
  value,
  subline,
  badge,
  icon,
}: {
  label: string;
  value: string;
  subline: string;
  badge?: string;
  icon: ReactNode;
}) {
  return (
    <div className="motus-progress-status-card motus-progress-status-card--weekly">
      <span className="motus-progress-status-icon motus-progress-status-icon--pink">{icon}</span>
      <p className="motus-progress-status-stat-value mt-1 font-black tabular-nums tracking-tight text-slate-950">
        {value}
      </p>
      <p className="motus-progress-status-label mt-0.5 font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="motus-progress-status-subline mt-0.5 line-clamp-2 text-slate-600">{subline}</p>
      {badge ? <span className="motus-progress-status-badge">{badge}</span> : null}
    </div>
  );
}

function ConfettiBurst({ active }: { active: boolean }) {
  if (!active) return null;
  const pieces = Array.from({ length: 14 }, (_, i) => i);
  return (
    <div className="motus-progress-confetti" aria-hidden>
      {pieces.map((i) => (
        <span key={i} className={`motus-progress-confetti-piece motus-progress-confetti-piece--${i % 7}`} />
      ))}
    </div>
  );
}

function _XpExplainerPanel({
  id,
  totalXp,
  breakdown,
  xpInLevel,
  xpForNextLevel,
  currentLevel,
  currentLevelLabel,
  nextLevelLabel,
}: {
  id: string;
  totalXp: number;
  breakdown: MemberProgressHeroCardProps["xpBreakdown"];
  xpInLevel: number;
  xpForNextLevel: number;
  currentLevel: number;
  currentLevelLabel: string;
  nextLevelLabel: string;
}) {
  const sessions = breakdown?.completedSessions ?? 0;
  const weeks = breakdown?.streakWeeks ?? 0;
  const achieved = breakdown?.achievedLevel ?? 0;
  const fromSessions = sessions * XP_PER_SESSION;
  const fromStreak = weeks * XP_PER_STREAK_WEEK;
  const fromAchieved = achieved * XP_PER_ACHIEVED_LEVEL;
  const xpToGo = Math.max(0, xpForNextLevel - xpInLevel);

  return (
    <div id={id} className="motus-progress-xp-explainer" role="region" aria-label="Slik fungerer XP">
      <p className="motus-progress-xp-explainer-title">Slik tjener du XP</p>
      <p className="motus-progress-xp-explainer-lead">
        XP samles inn fra tre ting. Jo mer du logger og holder rytmen, jo raskere stiger nivået ditt.
      </p>
      <ul className="motus-progress-xp-explainer-rules">
        <li>
          <span className="motus-progress-xp-explainer-rule-amount">+{XP_PER_SESSION} XP</span>
          <span className="motus-progress-xp-explainer-rule-text">per fullført økt</span>
        </li>
        <li>
          <span className="motus-progress-xp-explainer-rule-amount">+{XP_PER_STREAK_WEEK} XP</span>
          <span className="motus-progress-xp-explainer-rule-text">for hver uke du holder streaken</span>
        </li>
        <li>
          <span className="motus-progress-xp-explainer-rule-amount">+{XP_PER_ACHIEVED_LEVEL} XP</span>
          <span className="motus-progress-xp-explainer-rule-text">for hvert milepælnivå du låser opp (maks 10)</span>
        </li>
      </ul>

      {breakdown ? (
        <div className="motus-progress-xp-explainer-breakdown">
          <p className="motus-progress-xp-explainer-breakdown-title">Dine tall så langt</p>
          <ul className="motus-progress-xp-explainer-breakdown-list">
            <li>
              <span>
                {sessions} {sessions === 1 ? "fullført økt" : "fullførte økter"}
              </span>
              <span className="tabular-nums">{fromSessions.toLocaleString("nb-NO")} XP</span>
            </li>
            <li>
              <span>
                {weeks} {weeks === 1 ? "uke" : "uker"} streak
              </span>
              <span className="tabular-nums">{fromStreak.toLocaleString("nb-NO")} XP</span>
            </li>
            <li>
              <span>
                {achieved} {achieved === 1 ? "milepælnivå" : "milepælnivåer"} oppnådd
              </span>
              <span className="tabular-nums">{fromAchieved.toLocaleString("nb-NO")} XP</span>
            </li>
            <li className="motus-progress-xp-explainer-breakdown-total">
              <span>Totalt</span>
              <span className="tabular-nums">{totalXp.toLocaleString("nb-NO")} XP</span>
            </li>
          </ul>
        </div>
      ) : null}

      <div className="motus-progress-xp-explainer-next">
        <p>
          Du er på <strong>Level {currentLevel} — {currentLevelLabel}</strong>. Neste nivå er{" "}
          <strong>{nextLevelLabel}</strong> — <span className="tabular-nums">{xpToGo.toLocaleString("nb-NO")}</span> XP igjen.
        </p>
      </div>

      <p className="motus-progress-xp-explainer-tip">
        Tips: Én økt om dagen i en uke gir <span className="tabular-nums">{(XP_PER_SESSION * 7 + XP_PER_STREAK_WEEK).toLocaleString("nb-NO")}</span> XP — pluss eventuell milepæl-bonus.
      </p>
    </div>
  );
}

export function MemberProgressHeroCard({
  scores,
  memberFirstName,
  streakWeeks,
  recentStreakWeeks = [],
  personalRecordsCount = 0,
  xpBreakdown,
}: MemberProgressHeroCardProps) {
  const { momentum, consistency, weekly, recovery, xp } = scores;
  const planStatusPct = weekly.maxScore ? weekly.pct : 0;
  const animatedPlanStatusPct = useCountUpNumber(planStatusPct);
  const animatedConsistency = useCountUpNumber(consistency.pct);
  const animatedRecovery = useCountUpNumber(recovery.pct ?? 0);
  const animatedWeeklyScore = useCountUpNumber(weekly.score);
  const completedSessions = xpBreakdown?.completedSessions ?? 0;
  const rhythmWeeks = xpBreakdown?.streakWeeks ?? 0;
  const bestStreakWeeks = Math.max(computeBestStreakWeeks(recentStreakWeeks), streakWeeks);
  const plannedSessions = weekly.maxScore ?? 0;
  const completedPlanSessions = weekly.score;
  const remainingPlanSessions = Math.max(0, plannedSessions - completedPlanSessions);
  const extraPlanSessions = Math.max(0, completedPlanSessions - plannedSessions);
  const planWord = weekly.source === "profile" ? "ukemålet" : "planen";
  const planStatusTitle =
    !plannedSessions
      ? "Ingen plan"
      : extraPlanSessions > 0
        ? "Foran planen"
        : remainingPlanSessions === 0
          ? "I rute"
          : remainingPlanSessions === 1
            ? "Nesten i rute"
            : completedPlanSessions > 0
              ? "På vei"
              : "Bak planen";
  const planStatusSubline =
    !plannedSessions
      ? "Ingen aktiv plan denne uken. Sett et ukemål eller avtal plan med PT."
      : extraPlanSessions > 0
        ? `Du ligger foran ${planWord} med ${extraPlanSessions} ekstra ${extraPlanSessions === 1 ? "økt" : "økter"}.`
        : remainingPlanSessions === 0
          ? `Du har fulgt ${planWord} de siste 7 dagene.`
          : remainingPlanSessions === 1
            ? `Du har fullført ${completedPlanSessions} av ${plannedSessions} planlagte økter. Én økt gjenstår.`
            : `Du har fullført ${completedPlanSessions} av ${plannedSessions} planlagte økter.`;
  const rhythmTitle = rhythmWeeks >= 4 ? "Status: God rytme" : completedSessions > 0 ? "Status: I gang" : "Status: Klar for start";
  const rhythmSubline =
    rhythmWeeks > 0
      ? `${rhythmWeeks} ${rhythmWeeks === 1 ? "uke" : "uker"} med aktivitet. Små økter over tid bygger formen.`
      : completedSessions > 0
        ? "Du har startet. Jevn rytme over tid bygger formen."
        : "Start rolig og bygg rytmen uke for uke.";

  const milestoneRef = useRef<{ level: number; momentum: number }>({ level: xp.level, momentum: momentum.pct });
  const [confettiActive, setConfettiActive] = useState(false);
  useEffect(() => {
    const prev = milestoneRef.current;
    const leveledUp = xp.level > prev.level;
    const flowMilestone = planStatusPct >= 100 && prev.momentum < 100;
    if (leveledUp || flowMilestone) {
      setConfettiActive(true);
      const timer = window.setTimeout(() => setConfettiActive(false), 1800);
      milestoneRef.current = { level: xp.level, momentum: planStatusPct };
      return () => window.clearTimeout(timer);
    }
    milestoneRef.current = { level: xp.level, momentum: planStatusPct };
    return undefined;
  }, [xp.level, planStatusPct]);

  return (
    <section className="motus-progress-hero motus-fade-in-up">
      <div className="motus-progress-hero-header">
        <h2 className="motus-progress-hero-greeting">Hei {memberFirstName}! 👋</h2>
        <p className="motus-progress-hero-greeting-sub">Her er din fremgang så langt</p>
      </div>

      <div className="motus-progress-hero-dark">
        <div className="motus-progress-hero-dark-wave" aria-hidden />
        <ConfettiBurst active={confettiActive} />

        <div className="motus-progress-hero-dark-top motus-progress-hero-dark-top--simple">
          <div className="motus-progress-momentum-hero">
            <div className="motus-progress-momentum-hero-row">
              <p className="motus-progress-momentum-hero-eyebrow">Planstatus</p>
            </div>
            <div className="motus-progress-momentum-hero-value-row">
              <p className="motus-progress-momentum-hero-value motus-progress-momentum-hero-value--status">{planStatusTitle}</p>
            </div>
            <p className="motus-progress-momentum-hero-subline">{planStatusSubline}</p>
          </div>

          <MomentumRing pct={planStatusPct} animatedPct={animatedPlanStatusPct} />
        </div>

        <div className="motus-progress-level-summary">
          <div className="motus-progress-level-summary-main">
            <span className="motus-progress-level-summary-icon" aria-hidden>
              <Shield className="h-4 w-4" strokeWidth={2.25} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="motus-progress-level-summary-title">
                {rhythmTitle}
              </p>
              <p className="motus-progress-level-summary-xp">
                <span className="tabular-nums">{completedSessions.toLocaleString("nb-NO")}</span>
                {" "}
                {completedSessions === 1 ? "fullført økt" : "fullførte økter"}
              </p>
              <p className="motus-progress-level-summary-note">{rhythmSubline}</p>
              <div className="motus-progress-level-summary-track">
                <div className="motus-progress-level-summary-fill" style={{ width: `${Math.max(8, Math.min(100, planStatusPct))}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="motus-progress-status-grid">
        <h3 className="motus-progress-status-grid-title">Din status</h3>
        <ScoreRing
          label="Kontinuitet"
          value={`${animatedConsistency}%`}
          subline={consistency.subline}
          pct={consistency.pct}
          tone="mint"
        />
        <StatHighlight
          label="Uke-score"
          value={weekly.maxScore ? `${animatedWeeklyScore}/${weekly.maxScore}` : "Sett mål"}
          subline={weekly.subline}
          icon={<Target className="h-3.5 w-3.5 sm:h-4 sm:w-4" strokeWidth={2} />}
        />
        <ScoreRing
          label="Recovery"
          value={recovery.pct === null ? "—" : `${animatedRecovery}%`}
          subline={recovery.subline}
          pct={recovery.pct}
          tone="pink"
        />
        <div className="motus-progress-status-highlights">
          <div className="motus-progress-status-highlight">
            <span className="motus-progress-status-highlight-icon motus-progress-status-highlight-icon--pink" aria-hidden>
              <Flame className="h-4 w-4" strokeWidth={2.25} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="motus-progress-status-highlight-value">
                {streakWeeks} <span>{streakWeeks === 1 ? "ukes streak" : "ukers streak"}</span>
              </p>
              <p className="motus-progress-status-highlight-subline">{bestStreakSubline(streakWeeks, bestStreakWeeks)}</p>
            </div>
          </div>
          <div className="motus-progress-status-highlight">
            <span className="motus-progress-status-highlight-icon motus-progress-status-highlight-icon--mint" aria-hidden>
              <Trophy className="h-4 w-4" strokeWidth={2.25} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="motus-progress-status-highlight-value">
                {personalRecordsCount} <span>{personalRecordsCount === 1 ? "personlig rekord" : "personlige rekorder"}</span>
              </p>
              <p className="motus-progress-status-highlight-subline">{personalRecordSubline(personalRecordsCount)}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export type { MemberProgressHeroCardProps };
