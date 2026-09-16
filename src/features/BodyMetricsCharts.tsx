import { useMemo, useState } from "react";
import { LineChart, X } from "lucide-react";
import { MOTUS } from "../app/data";
import {
  bodyMetricSourceLabel,
  buildMetricChartGeometry,
  computeMetricChange,
  type BodyMetricChartPoint,
} from "../app/memberBodyMetrics";

const CHART_WIDTH = 340;
const CHART_HEIGHT = 180;
const MOTUS_GRADIENT = `${MOTUS.gradient}`;

export function formatBodyMetricValue(value: number, unit: "kg" | "%", signed = false): string {
  const rounded = Math.round(value * 10) / 10;
  const text = String(rounded).replace(".", ",");
  if (unit === "kg") return signed ? `${text} kg` : `${text} kg`;
  return signed ? `${text} %` : `${text} %`;
}

function BodyMetricsHistoryModal({
  title,
  unit,
  series,
  onClose,
}: {
  title: string;
  unit: "kg" | "%";
  series: BodyMetricChartPoint[];
  onClose: () => void;
}) {
  const rows = [...series].reverse();
  return (
    <div
      className="motus-modal-insets fixed inset-0 z-[10025] flex items-end justify-center overflow-y-auto overscroll-contain bg-slate-900/50 px-4 py-8 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="body-metrics-history-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-4 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-teal-700">Alle målinger</p>
            <h3 id="body-metrics-history-title" className="text-base font-bold text-slate-900">
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600"
            aria-label="Lukk"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {rows.length === 0 ? (
          <p className="text-sm text-slate-600">Ingen målinger registrert ennå.</p>
        ) : (
          <ul className="max-h-[min(24rem,60vh)] space-y-2 overflow-y-auto">
            {rows.map((point) => (
              <li
                key={point.entryId}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
              >
                <div>
                  <div className="text-sm font-semibold text-slate-900">{point.dateLabel}</div>
                  <div className="text-[11px] text-slate-500">{bodyMetricSourceLabel(point.source)}</div>
                </div>
                <div className="text-sm font-bold text-slate-900">{formatBodyMetricValue(point.value, unit)}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function MetricLineChart({
  title,
  unit,
  series,
  gradientId,
  strokeColor,
}: {
  title: string;
  unit: "kg" | "%";
  series: BodyMetricChartPoint[];
  gradientId: string;
  strokeColor: string;
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const geometry = useMemo(
    () => buildMetricChartGeometry(series, CHART_WIDTH, CHART_HEIGHT, unit),
    [series, unit],
  );
  const hoveredPoint = hoveredIndex !== null ? series[hoveredIndex] : series[series.length - 1] ?? null;
  const change = computeMetricChange(series);

  if (series.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-center text-sm text-slate-600">
        Ingen {title.toLowerCase()} registrert ennå.
      </div>
    );
  }

  const countButton = (
    <button
      type="button"
      onClick={() => setHistoryOpen(true)}
      className="rounded-xl bg-slate-50 px-2 py-2 text-center transition hover:bg-teal-50"
      aria-label={`Vis alle ${title.toLowerCase()}-målinger`}
    >
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Målinger</div>
      <div className="mt-0.5 text-sm font-bold text-teal-800 underline decoration-teal-300 underline-offset-2">
        {series.length}
      </div>
    </button>
  );

  return (
    <div>
      {series.length === 1 ? (
        <div className="space-y-2">
          <p className="text-xs text-slate-500">Én måling — logg flere for å se utviklingen som graf.</p>
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <div className="rounded-xl border bg-teal-50 px-4 py-3 text-sm text-teal-950" style={{ borderColor: "rgba(48,227,190,0.25)" }}>
              <div className="font-semibold">{series[0].dateLabel}</div>
              <div className="mt-1">
                {title}: <span className="font-bold">{formatBodyMetricValue(series[0].value, unit)}</span>
                <span className="ml-2 text-xs text-teal-800">({bodyMetricSourceLabel(series[0].source)})</span>
              </div>
            </div>
            {countButton}
          </div>
        </div>
      ) : (
        <>
          <div className="mb-2 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-slate-50 px-2 py-2">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Siste</div>
              <div className="mt-0.5 text-sm font-bold text-slate-900">
                {formatBodyMetricValue(series[series.length - 1].value, unit)}
              </div>
            </div>
            {countButton}
            <div className="rounded-xl bg-slate-50 px-2 py-2">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Endring</div>
              <div className={`mt-0.5 text-sm font-bold ${change !== null && change <= 0 ? "text-emerald-700" : "text-amber-700"}`}>
                {change === null ? "–" : `${change >= 0 ? "+" : ""}${formatBodyMetricValue(change, unit, true)}`}
              </div>
            </div>
          </div>

          {hoveredPoint ? (
            <div className="mb-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
              <span className="font-semibold">{hoveredPoint.dateLabel}</span>
              {" · "}
              {title} <span className="font-bold text-slate-900">{formatBodyMetricValue(hoveredPoint.value, unit)}</span>
              {" · "}
              {bodyMetricSourceLabel(hoveredPoint.source)}
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <svg
              viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
              className="w-full min-w-[260px]"
              role="img"
              aria-label={`Graf over ${title.toLowerCase()}`}
            >
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={strokeColor} stopOpacity="0.35" />
                  <stop offset="100%" stopColor={MOTUS.pink} stopOpacity="0.05" />
                </linearGradient>
              </defs>
              {geometry?.yTicks.map((tick) => (
                <g key={tick.label}>
                  <line x1={40} x2={CHART_WIDTH - 12} y1={tick.y} y2={tick.y} stroke="rgba(148,163,184,0.35)" strokeDasharray="4 4" />
                  <text x={36} y={tick.y + 4} textAnchor="end" className="fill-slate-400 text-[9px]">
                    {tick.label}
                  </text>
                </g>
              ))}
              {geometry ? (
                <>
                  <path d={geometry.areaPath} fill={`url(#${gradientId})`} />
                  <path
                    d={geometry.linePath}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {geometry.dots.map((dot, index) => (
                    <g
                      key={dot.point.entryId}
                      onMouseEnter={() => setHoveredIndex(index)}
                      onMouseLeave={() => setHoveredIndex(null)}
                    >
                      <circle cx={dot.x} cy={dot.y} r="12" fill="transparent" />
                      <circle
                        cx={dot.x}
                        cy={dot.y}
                        r={hoveredIndex === index ? 5.5 : 4}
                        fill={hoveredIndex === index ? MOTUS.pink : "#fff"}
                        stroke={strokeColor}
                        strokeWidth="2"
                      />
                    </g>
                  ))}
                </>
              ) : null}
              {geometry?.xLabels.map((label) => (
                <text key={label.label} x={label.x} y={CHART_HEIGHT - 8} textAnchor="middle" className="fill-slate-500 text-[9px]">
                  {label.label}
                </text>
              ))}
            </svg>
          </div>
        </>
      )}
      {historyOpen ? (
        <BodyMetricsHistoryModal title={title} unit={unit} series={series} onClose={() => setHistoryOpen(false)} />
      ) : null}
    </div>
  );
}

export function BodyMetricsCharts({
  weightSeries,
  bodyFatSeries,
  idPrefix = "body",
}: {
  weightSeries: BodyMetricChartPoint[];
  bodyFatSeries: BodyMetricChartPoint[];
  idPrefix?: string;
}) {
  return (
    <div className="space-y-5">
      <div>
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800">
          <LineChart className="h-4 w-4 text-teal-600" />
          Vekt over tid
        </div>
        <MetricLineChart
          title="Vekt"
          unit="kg"
          series={weightSeries}
          gradientId={`${idPrefix}-weight-gradient`}
          strokeColor={MOTUS.turquoise}
        />
      </div>
      <div>
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800">
          <LineChart className="h-4 w-4 text-teal-600" />
          Fettprosent over tid
        </div>
        <MetricLineChart
          title="Fettprosent"
          unit="%"
          series={bodyFatSeries}
          gradientId={`${idPrefix}-fat-gradient`}
          strokeColor={MOTUS.pink}
        />
      </div>
    </div>
  );
}
