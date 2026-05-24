import { BarChart3 } from "lucide-react";
import { MOTUS } from "../app/data";

type PeriodPlanPeriodProgressCardProps = {
  completed: number;
  total: number;
  pct: number;
};

export function PeriodPlanPeriodProgressCard({ completed, total, pct }: PeriodPlanPeriodProgressCardProps) {
  const ringPct = Math.min(100, Math.max(0, pct));
  const dash = `${Math.max(8, (ringPct / 100) * 226)} 226`;

  return (
    <section className="motus-period-plan-progress-card" aria-label="Fremgang i perioden">
      <span className="motus-period-plan-progress-icon" aria-hidden>
        <BarChart3 className="h-5 w-5" strokeWidth={2.25} />
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-bold text-slate-950">Fremgang i denne perioden</h3>
        <p className="mt-0.5 text-sm text-slate-600">
          {completed} av {total} planlagte {total === 1 ? "økt" : "økter"} fullført
        </p>
      </div>
      <div className="motus-period-plan-progress-ring" aria-hidden>
        <svg viewBox="0 0 88 88" className="h-14 w-14">
          <circle cx="44" cy="44" r="36" fill="none" stroke="rgba(15,23,42,0.08)" strokeWidth="6" />
          <circle
            cx="44"
            cy="44"
            r="36"
            fill="none"
            stroke={MOTUS.turquoise}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={dash}
            transform="rotate(-90 44 44)"
          />
        </svg>
        <span className="motus-period-plan-progress-ring-value">{pct}%</span>
      </div>
    </section>
  );
}
