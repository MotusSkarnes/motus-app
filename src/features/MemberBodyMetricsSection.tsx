import { useMemo, useState, type FormEvent } from "react";
import { LineChart, Scale } from "lucide-react";
import { MOTUS } from "../app/data";
import {
  bodyMetricSourceLabel,
  buildBodyMetricsTimeline,
  buildMetricChartGeometry,
  computeMetricChange,
  type BodyMetricChartPoint,
} from "../app/memberBodyMetrics";
import { GradientButton, TextInput } from "../app/ui";

const CHART_WIDTH = 340;
const CHART_HEIGHT = 180;
const MOTUS_GRADIENT = `${MOTUS.gradient}`;

type MemberBodyMetricsSectionProps = {
  personalGoals: string | undefined;
  targetWeight?: string;
  onLog: (input: { weightKg?: number; bodyFatPct?: number }) => void | Promise<void>;
  isSaving?: boolean;
};

function MetricLineChart({
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

  if (series.length === 1) {
    const point = series[0];
    return (
      <div className="space-y-2">
        <p className="text-xs text-slate-500">Én måling — logg flere for å se utviklingen som graf.</p>
        <div className="rounded-xl border bg-teal-50 px-4 py-3 text-sm text-teal-950" style={{ borderColor: "rgba(48,227,190,0.25)" }}>
          <div className="font-semibold">{point.dateLabel}</div>
          <div className="mt-1">
            {title}: <span className="font-bold">{formatValue(point.value, unit)}</span>
            <span className="ml-2 text-xs text-teal-800">({bodyMetricSourceLabel(point.source)})</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-2 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-slate-50 px-2 py-2">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Siste</div>
          <div className="mt-0.5 text-sm font-bold text-slate-900">{formatValue(series[series.length - 1].value, unit)}</div>
        </div>
        <div className="rounded-xl bg-slate-50 px-2 py-2">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Målinger</div>
          <div className="mt-0.5 text-sm font-bold text-slate-900">{series.length}</div>
        </div>
        <div className="rounded-xl bg-slate-50 px-2 py-2">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Endring</div>
          <div className={`mt-0.5 text-sm font-bold ${change !== null && change <= 0 ? "text-emerald-700" : "text-amber-700"}`}>
            {change === null ? "–" : `${change >= 0 ? "+" : ""}${formatValue(change, unit, true)}`}
          </div>
        </div>
      </div>

      {hoveredPoint ? (
        <div className="mb-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
          <span className="font-semibold">{hoveredPoint.dateLabel}</span>
          {" · "}
          {title} <span className="font-bold text-slate-900">{formatValue(hoveredPoint.value, unit)}</span>
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
    </div>
  );
}

function formatValue(value: number, unit: "kg" | "%", signed = false): string {
  const rounded = Math.round(value * 10) / 10;
  const text = String(rounded).replace(".", ",");
  if (unit === "kg") return signed ? `${text} kg` : `${text} kg`;
  return signed ? `${text} %` : `${text} %`;
}

function parseDecimalInput(raw: string): number | undefined {
  const trimmed = raw.trim().replace(",", ".");
  if (!trimmed) return undefined;
  const n = Number.parseFloat(trimmed);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return n;
}

export function MemberBodyMetricsSection({
  personalGoals,
  targetWeight,
  onLog,
  isSaving = false,
}: MemberBodyMetricsSectionProps) {
  const [weightInput, setWeightInput] = useState("");
  const [bodyFatInput, setBodyFatInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const timeline = useMemo(() => buildBodyMetricsTimeline(personalGoals), [personalGoals]);
  const latestWeight = timeline.weightSeries[timeline.weightSeries.length - 1]?.value ?? null;
  const latestBodyFat = timeline.bodyFatSeries[timeline.bodyFatSeries.length - 1]?.value ?? null;
  const targetWeightNum = parseDecimalInput(targetWeight ?? "");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const weightKg = parseDecimalInput(weightInput);
    const bodyFatPct = parseDecimalInput(bodyFatInput);
    if (weightKg === undefined && bodyFatPct === undefined) {
      setError("Oppgi vekt og/eller fettprosent.");
      return;
    }
    if (bodyFatPct !== undefined && bodyFatPct > 100) {
      setError("Fettprosent må være under 100.");
      return;
    }
    setError(null);
    await onLog({ weightKg, bodyFatPct });
    setWeightInput("");
    setBodyFatInput("");
  }

  return (
    <section className="motus-progress-section-card">
      <div className="flex items-start gap-3">
        <span className="inline-flex shrink-0 rounded-xl p-2.5 text-white shadow-sm" style={{ background: MOTUS_GRADIENT }}>
          <Scale className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Kroppssammensetning</p>
          <h3 className="mt-0.5 text-lg font-bold text-slate-900">Vekt og fettprosent</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Logg vekt selv når som helst. Tanita-målinger fra månedlig sjekk-inn vises automatisk i grafene.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Siste vekt</div>
          <div className="mt-1 text-xl font-bold text-slate-900">
            {latestWeight !== null ? formatValue(latestWeight, "kg") : "–"}
          </div>
          {targetWeightNum !== undefined ? (
            <div className="mt-1 text-xs text-slate-600">
              Målvekt: <span className="font-semibold">{formatValue(targetWeightNum, "kg")}</span>
              {latestWeight !== null ? (
                <span className="ml-1 text-slate-500">
                  ({latestWeight - targetWeightNum >= 0 ? "+" : ""}
                  {formatValue(latestWeight - targetWeightNum, "kg", true).replace(" kg", "")} kg)
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Siste fettprosent</div>
          <div className="mt-1 text-xl font-bold text-slate-900">
            {latestBodyFat !== null ? formatValue(latestBodyFat, "%") : "–"}
          </div>
          <div className="mt-1 text-xs text-slate-500">Ofte fra Tanita ved sjekk-inn</div>
        </div>
      </div>

      <form className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-white p-4" onSubmit={(event) => void handleSubmit(event)}>
        <p className="text-sm font-semibold text-slate-800">Logg ny måling</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Vekt (kg)</span>
            <TextInput
              value={weightInput}
              onChange={(event) => setWeightInput(event.target.value)}
              inputMode="decimal"
              placeholder="f.eks. 78,5"
              disabled={isSaving}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Fettprosent (%) — valgfritt</span>
            <TextInput
              value={bodyFatInput}
              onChange={(event) => setBodyFatInput(event.target.value)}
              inputMode="decimal"
              placeholder="f.eks. 18,2"
              disabled={isSaving}
            />
          </label>
        </div>
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        <GradientButton type="submit" disabled={isSaving}>
          {isSaving ? "Lagrer…" : "Lagre måling"}
        </GradientButton>
      </form>

      <div className="mt-5 space-y-5">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800">
            <LineChart className="h-4 w-4 text-teal-600" />
            Vekt over tid
          </div>
          <MetricLineChart
            title="Vekt"
            unit="kg"
            series={timeline.weightSeries}
            gradientId="body-weight-gradient"
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
            series={timeline.bodyFatSeries}
            gradientId="body-fat-gradient"
            strokeColor={MOTUS.pink}
          />
        </div>
      </div>
    </section>
  );
}
