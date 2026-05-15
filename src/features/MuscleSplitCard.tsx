import { BarChart3 } from "lucide-react";
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

function segmentButtonClass(active: boolean): string {
  return active
    ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
    : "text-slate-600 hover:text-slate-900";
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
  const periodLabel = PERIOD_OPTIONS.find((option) => option.value === period)?.label ?? "";

  return (
    <div className="mt-4 rounded-xl border bg-slate-50 p-4" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <div
            className="shrink-0 rounded-xl p-2 text-white shadow-sm"
            style={{ background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` }}
          >
            <BarChart3 className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-800">Muskelsplitt</div>
            <div className="mt-1 text-xs text-slate-500">
              Fordeling av sett og styrkevolum (vekt × reps) på tvers av muskelgrupper — {periodLabel.toLowerCase()}.
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <div
            className="inline-flex rounded-lg border bg-white p-0.5"
            style={{ borderColor: "rgba(15,23,42,0.10)" }}
            role="group"
            aria-label="Tidsperiode"
          >
            {PERIOD_OPTIONS.map((option) => (
              <button
                key={String(option.value)}
                type="button"
                onClick={() => onPeriodChange(option.value)}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${segmentButtonClass(period === option.value)}`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div
            className="inline-flex rounded-lg border bg-white p-0.5"
            style={{ borderColor: "rgba(15,23,42,0.10)" }}
            role="group"
            aria-label="Visning"
          >
            <button
              type="button"
              onClick={() => onMetricChange("sets")}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${segmentButtonClass(metric === "sets")}`}
            >
              Sett
            </button>
            <button
              type="button"
              onClick={() => onMetricChange("volume")}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${segmentButtonClass(metric === "volume")}`}
            >
              Volum
            </button>
          </div>
        </div>
      </div>

      {topGroups.length === 0 ? (
        <EmptyState
          icon="📊"
          title="Ingen splitt ennå"
          description="Fullfør styrke- eller kondisjonsøkter med logging — da vises fordelingen per muskelgruppe her."
          className="mt-4 bg-white"
        />
      ) : (
        <ul className="mt-4 space-y-3">
          {topGroups.map((row, index) => {
            const value = muscleSplitMetricValue(row, metric);
            const share = total > 0 ? Math.round((value / total) * 100) : 0;
            const width = Math.max(6, Math.round((value / max) * 100));
            const barStop = index % 2 === 0 ? MOTUS.turquoise : MOTUS.pink;

            return (
              <li key={row.group}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium text-slate-800">{row.group}</span>
                  <span className="shrink-0 tabular-nums text-slate-600">
                    {formatMuscleSplitMetricValue(value, metric)}
                    <span className="ml-1.5 text-xs text-slate-400">({share}%)</span>
                  </span>
                </div>
                <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-slate-200/90">
                  <div
                    className="h-full rounded-full transition-[width] duration-500 ease-out"
                    style={{
                      width: `${width}%`,
                      background: `linear-gradient(90deg, ${barStop} 0%, ${MOTUS.pink} 100%)`,
                    }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {stats.length > 10 ? (
        <p className="mt-3 text-xs text-slate-500">Viser topp 10 av {stats.length} muskelgrupper i perioden.</p>
      ) : null}
    </div>
  );
}
