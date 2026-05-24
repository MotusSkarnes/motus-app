import type { LucideIcon } from "lucide-react";
import { Activity, BarChart3, BicepsFlexed, Dumbbell, Footprints, Heart, PersonStanding, Shield } from "lucide-react";
import { MOTUS } from "../app/data";
import { EmptyState } from "../app/ui";
import type { MuscleGroupStat, MuscleSplitMetric, MuscleSplitPeriod } from "./muscleSplitStats";
import { formatMuscleSplitMetricValue, muscleSplitMetricValue } from "./muscleSplitStats";

type MuscleSplitCardProps = {
  stats: MuscleGroupStat[];
  metric: MuscleSplitMetric;
  period: MuscleSplitPeriod;
  onMetricChange: (metric: MuscleSplitMetric) => void;
  onPeriodChange: (period: MuscleSplitPeriod) => void;
};

const PERIOD_OPTIONS: { value: MuscleSplitPeriod; label: string }[] = [
  { value: 28, label: "4 uker" },
  { value: 90, label: "3 mnd" },
  { value: "all", label: "Alt" },
];

const MUSCLE_GROUP_ICONS: Record<string, LucideIcon> = {
  Bein: Footprints,
  Rygg: Activity,
  Bryst: Heart,
  Skuldre: PersonStanding,
  Biceps: BicepsFlexed,
  Triceps: Dumbbell,
  Mage: Shield,
  Core: Shield,
};

function segmentButtonClass(active: boolean): string {
  return active ? "motus-muscle-split-segment-btn motus-muscle-split-segment-btn--active" : "motus-muscle-split-segment-btn";
}

function MuscleGroupIcon({ group }: { group: string }) {
  const Icon = MUSCLE_GROUP_ICONS[group] ?? Dumbbell;
  return (
    <span className="motus-muscle-split-icon" aria-hidden>
      <Icon className="h-3.5 w-3.5" strokeWidth={2.25} />
    </span>
  );
}

export function MuscleSplitCard({
  stats,
  metric,
  period,
  onMetricChange,
  onPeriodChange,
}: MuscleSplitCardProps) {
  const total = stats.reduce((sum, row) => sum + muscleSplitMetricValue(row, metric), 0);
  const max = Math.max(...stats.map((row) => muscleSplitMetricValue(row, metric)), 1);
  const topGroups = stats.slice(0, 10);

  return (
    <section className="motus-progress-section-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <div className="motus-muscle-split-header-icon shrink-0" aria-hidden>
            <BarChart3 className="h-4 w-4" strokeWidth={2.25} />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-bold tracking-tight text-slate-900">Muskelsplitt</h3>
            <p className="mt-0.5 text-xs text-slate-500">Fordeling per muskelgruppe</p>
          </div>
        </div>

        <div className="motus-muscle-split-segment" role="group" aria-label="Visning">
          <button type="button" onClick={() => onMetricChange("sets")} className={segmentButtonClass(metric === "sets")}>
            Sett
          </button>
          <button type="button" onClick={() => onMetricChange("volume")} className={segmentButtonClass(metric === "volume")}>
            Volum
          </button>
        </div>
      </div>

      {topGroups.length === 0 ? (
        <EmptyState
          icon="📊"
          title="Ingen splitt ennå"
          description="Fullfør styrke- eller kondisjonsøkter med logging — da vises fordelingen per muskelgruppe her."
          className="mt-4 bg-slate-50/80"
        />
      ) : (
        <ul className="motus-muscle-split-grid mt-3">
          {topGroups.map((row, index) => {
            const value = muscleSplitMetricValue(row, metric);
            const share = total > 0 ? Math.round((value / total) * 100) : 0;
            const width = Math.max(6, Math.round((value / max) * 100));
            const isTop = index === 0 && value > 0;

            return (
              <li key={row.group} className={`motus-muscle-split-row ${isTop ? "motus-muscle-split-row--active" : ""}`}>
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2 font-medium text-slate-800">
                    <MuscleGroupIcon group={row.group} />
                    <span className="truncate">{row.group}</span>
                  </span>
                  <span className="shrink-0 tabular-nums text-xs text-slate-500">
                    {formatMuscleSplitMetricValue(value, metric)}
                    <span className="ml-1 text-slate-400">({share}%)</span>
                  </span>
                </div>
                <div className="motus-muscle-split-track">
                  <div
                    className="motus-muscle-split-fill"
                    style={{
                      width: `${width}%`,
                      background: isTop
                        ? MOTUS.gradient
                        : index % 3 === 1
                          ? `linear-gradient(90deg, ${MOTUS.turquoise} 0%, ${MOTUS.turquoise}99 100%)`
                          : index % 3 === 2
                            ? `linear-gradient(90deg, ${MOTUS.pink}99 0%, ${MOTUS.pink} 100%)`
                            : "linear-gradient(90deg, rgba(148,163,184,0.55) 0%, rgba(148,163,184,0.3) 100%)",
                    }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="motus-muscle-split-period mt-4" role="group" aria-label="Tidsperiode">
        {PERIOD_OPTIONS.map((option) => (
          <button
            key={String(option.value)}
            type="button"
            onClick={() => onPeriodChange(option.value)}
            className={segmentButtonClass(period === option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>

      {stats.length > 10 ? <p className="mt-3 text-xs text-slate-500">Viser topp 10 av {stats.length} muskelgrupper i perioden.</p> : null}
    </section>
  );
}
