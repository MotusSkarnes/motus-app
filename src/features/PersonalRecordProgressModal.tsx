import { useMemo, useState } from "react";
import { LineChart, Share2, X } from "lucide-react";
import { MOTUS } from "../app/data";
import { motusShareStatusMessage, sharePersonalRecordCard } from "../app/motusShareCard";
import { buildExerciseStrengthHistory, buildStrengthChartGeometry } from "../app/personalRecordProgress";
import type { WorkoutLog } from "../app/types";
import { GradientButton, OutlineButton } from "../app/ui";

const CHART_WIDTH = 340;
const CHART_HEIGHT = 200;
const MOTUS_GRADIENT = `${MOTUS.gradient}`;

type PersonalRecordProgressModalProps = {
  exerciseName: string;
  logs: WorkoutLog[];
  memberDisplayName?: string;
  shareLogoSrc?: string;
  onShareStatus?: (message: string | null) => void;
  onClose: () => void;
};

function parseBestSetLabel(label: string): { weightKg: number; reps: number } | null {
  const match = label.match(/^([\d.,]+)\s*kg\s*×\s*(\d+)/i);
  if (!match) return null;
  const weightKg = Number.parseFloat(match[1].replace(",", "."));
  const reps = Number.parseInt(match[2], 10);
  if (!Number.isFinite(weightKg) || !Number.isFinite(reps) || weightKg <= 0 || reps <= 0) return null;
  return { weightKg, reps };
}

export function PersonalRecordProgressModal({
  exerciseName,
  logs,
  memberDisplayName,
  shareLogoSrc,
  onShareStatus,
  onClose,
}: PersonalRecordProgressModalProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [isSharing, setIsSharing] = useState(false);

  const history = useMemo(() => buildExerciseStrengthHistory(logs, exerciseName), [exerciseName, logs]);
  const geometry = useMemo(
    () => buildStrengthChartGeometry(history, CHART_WIDTH, CHART_HEIGHT),
    [history],
  );
  const hoveredPoint = hoveredIndex !== null ? history[hoveredIndex] : history[history.length - 1] ?? null;
  const latest = history[history.length - 1] ?? null;
  const first = history[0] ?? null;
  const changeKg =
    latest && first && history.length > 1 ? Math.round((latest.estimated1RmKg - first.estimated1RmKg) * 10) / 10 : null;
  const canShare = Boolean(memberDisplayName && shareLogoSrc && latest);
  const latestSet = latest ? parseBestSetLabel(latest.bestSetLabel) : null;

  async function shareLatestRecord() {
    if (!canShare || !latest || !latestSet || !memberDisplayName || !shareLogoSrc || isSharing) return;
    setIsSharing(true);
    onShareStatus?.(null);
    try {
      const outcome = await sharePersonalRecordCard({
        logoSrc: shareLogoSrc,
        memberDisplayName,
        exerciseName,
        weightKg: latestSet.weightKg,
        reps: latestSet.reps,
        estimated1RmKg: latest.estimated1RmKg,
        previousEstimated1RmKg: history.length > 1 ? first?.estimated1RmKg : undefined,
      });
      onShareStatus?.(motusShareStatusMessage(outcome));
    } finally {
      setIsSharing(false);
    }
  }

  return (
    <div
      className="motus-modal-insets fixed inset-0 z-[10025] flex items-end justify-center overflow-y-auto overscroll-contain bg-slate-900/50 px-4 py-8 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pr-progress-title"
      onClick={onClose}
    >
      <div
        className="motus-pop-in w-full max-w-lg rounded-2xl border bg-white p-5 shadow-2xl sm:p-6"
        style={{ borderColor: "rgba(15,23,42,0.1)" }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="inline-flex shrink-0 rounded-xl p-2.5 text-white shadow-sm" style={{ background: MOTUS_GRADIENT }}>
              <LineChart className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Styrkeutvikling</p>
              <h2 id="pr-progress-title" className="mt-0.5 text-lg font-bold text-slate-900">
                {exerciseName}
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">Estimert 1RM over tid (fra loggede sett)</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
            aria-label="Lukk"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {history.length === 0 ? (
          <p className="mt-5 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-600">
            Ingen fullførte sett er registrert for denne øvelsen ennå.
          </p>
        ) : history.length === 1 ? (
          <div className="mt-5 space-y-3">
            <p className="text-sm text-slate-600">Du har én registrering — logg flere økter for å se utviklingen som graf.</p>
            <div className="rounded-xl border bg-teal-50 px-4 py-3 text-sm text-teal-950" style={{ borderColor: "rgba(48,227,190,0.25)" }}>
              <div className="font-semibold">{history[0].dateLabel}</div>
              <div className="mt-1">
                Estimert 1RM: <span className="font-bold">{history[0].estimated1RmKg} kg</span> ({history[0].bestSetLabel})
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-slate-50 px-2 py-2.5">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Siste</div>
                <div className="mt-0.5 text-sm font-bold text-slate-900">{latest?.estimated1RmKg} kg</div>
              </div>
              <div className="rounded-xl bg-slate-50 px-2 py-2.5">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Økter</div>
                <div className="mt-0.5 text-sm font-bold text-slate-900">{history.length}</div>
              </div>
              <div className="rounded-xl bg-slate-50 px-2 py-2.5">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Endring</div>
                <div
                  className={`mt-0.5 text-sm font-bold ${changeKg !== null && changeKg >= 0 ? "text-emerald-700" : "text-rose-700"}`}
                >
                  {changeKg === null ? "–" : `${changeKg >= 0 ? "+" : ""}${changeKg} kg`}
                </div>
              </div>
            </div>

            {hoveredPoint ? (
              <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                <span className="font-semibold">{hoveredPoint.dateLabel}</span>
                {" · "}
                Estimert 1RM <span className="font-bold text-slate-900">{hoveredPoint.estimated1RmKg} kg</span>
                {" · "}
                Beste sett: {hoveredPoint.bestSetLabel}
              </div>
            ) : null}

            <div className="mt-3 overflow-x-auto">
              <svg
                viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
                className="w-full min-w-[280px]"
                role="img"
                aria-label={`Graf over estimert 1RM for ${exerciseName}`}
              >
                <defs>
                  <linearGradient id="pr-area-gradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={MOTUS.turquoise} stopOpacity="0.35" />
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
                    <path d={geometry.areaPath} fill="url(#pr-area-gradient)" />
                    <path d={geometry.linePath} fill="none" stroke={MOTUS.turquoise} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    {geometry.dots.map((dot, index) => (
                      <g
                        key={dot.point.dateMs}
                        onMouseEnter={() => setHoveredIndex(index)}
                        onMouseLeave={() => setHoveredIndex(null)}
                      >
                        <circle cx={dot.x} cy={dot.y} r="12" fill="transparent" />
                        <circle
                          cx={dot.x}
                          cy={dot.y}
                          r={hoveredIndex === index ? 5.5 : 4}
                          fill={hoveredIndex === index ? MOTUS.pink : "#fff"}
                          stroke={MOTUS.turquoise}
                          strokeWidth="2"
                        />
                      </g>
                    ))}
                  </>
                ) : null}
                {geometry?.xLabels.map((label) => (
                  <text key={label.label} x={label.x} y={CHART_HEIGHT - 6} textAnchor="middle" className="fill-slate-500 text-[9px]">
                    {label.label}
                  </text>
                ))}
              </svg>
            </div>
          </>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          {canShare && latestSet ? (
            <OutlineButton
              type="button"
              onClick={() => void shareLatestRecord()}
              disabled={isSharing}
              className="min-h-11 w-full font-semibold sm:w-auto sm:flex-1"
            >
              <Share2 className="mr-2 inline h-4 w-4 shrink-0" aria-hidden />
              {isSharing ? "Lager skrytekort…" : "Del rekorden"}
            </OutlineButton>
          ) : null}
          <GradientButton type="button" onClick={onClose} className="min-h-11 flex-1 font-semibold">
            Lukk
          </GradientButton>
          <OutlineButton type="button" onClick={onClose} className="min-h-11 sm:flex-none">
            Tilbake
          </OutlineButton>
        </div>
      </div>
    </div>
  );
}
