import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { MOTUS } from "../app/data";
import type { PeriodPlanWeekNavItem } from "../app/periodPlanMerge";

export type { PeriodPlanWeekNavItem };

const MOTUS_GRADIENT = `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)`;

type PeriodPlanWeekNavigatorProps = {
  weeks: PeriodPlanWeekNavItem[];
  /** Velg uke via id (trenerutkast). */
  selectedWeekId?: string;
  /** Velg uke via nummer (medlem). */
  selectedWeekNumber?: number;
  onWeekSelectById?: (weekId: string) => void;
  onWeekSelectByNumber?: (weekNumber: number) => void;
  /** Kalenderuke i planen (1-basert), null hvis ukjent / ikke relevant. */
  currentWeekNumber?: number | null;
  formatWeekRange?: (weekNumber: number) => string | null;
  className?: string;
};

export function PeriodPlanWeekNavigator({
  weeks,
  selectedWeekId,
  selectedWeekNumber,
  onWeekSelectById,
  onWeekSelectByNumber,
  currentWeekNumber = null,
  formatWeekRange,
  className = "",
}: PeriodPlanWeekNavigatorProps) {
  const sortedWeeks = useMemo(
    () => [...weeks].sort((a, b) => a.weekNumber - b.weekNumber),
    [weeks],
  );

  const externalIndex = useMemo(() => {
    if (!sortedWeeks.length) return 0;
    if (selectedWeekId) {
      const byId = sortedWeeks.findIndex((week) => week.id === selectedWeekId);
      if (byId >= 0) return byId;
    }
    if (selectedWeekNumber != null) {
      const target = Number(selectedWeekNumber);
      const byNumber = sortedWeeks.findIndex((week) => Number(week.weekNumber) === target);
      if (byNumber >= 0) return byNumber;
    }
    return 0;
  }, [sortedWeeks, selectedWeekId, selectedWeekNumber]);

  const [activeIndex, setActiveIndex] = useState(externalIndex);

  useEffect(() => {
    setActiveIndex(externalIndex);
  }, [externalIndex]);

  const goToIndex = useCallback(
    (index: number) => {
      if (!sortedWeeks.length) return;
      const clamped = Math.max(0, Math.min(sortedWeeks.length - 1, index));
      const week = sortedWeeks[clamped];
      if (!week) return;
      setActiveIndex(clamped);
      onWeekSelectById?.(week.id);
      onWeekSelectByNumber?.(Number(week.weekNumber));
    },
    [sortedWeeks, onWeekSelectById, onWeekSelectByNumber],
  );

  if (!sortedWeeks.length) return null;

  const activeWeek = sortedWeeks[activeIndex] ?? sortedWeeks[0];
  const weekRange = formatWeekRange?.(activeWeek.weekNumber) ?? null;
  const canGoPrev = activeIndex > 0;
  const canGoNext = activeIndex < sortedWeeks.length - 1;
  const showNowBadge = currentWeekNumber != null;

  return (
    <div className={`relative z-10 space-y-2 ${className}`.trim()}>
      <div className="flex items-stretch gap-2">
        <button
          type="button"
          disabled={!canGoPrev}
          onClick={() => goToIndex(activeIndex - 1)}
          className="relative z-10 inline-flex h-10 w-10 shrink-0 touch-manipulation items-center justify-center rounded-xl border bg-white text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          style={{ borderColor: "rgba(15,23,42,0.10)" }}
          aria-label="Forrige uke"
        >
          <ChevronLeft className="pointer-events-none h-5 w-5" aria-hidden />
        </button>

        <div
          className="flex min-w-0 flex-1 flex-col items-center justify-center rounded-xl border bg-white px-3 py-2 text-center"
          style={{ borderColor: "rgba(15,23,42,0.10)" }}
        >
          <div className="text-sm font-semibold text-slate-800 inline-flex items-center justify-center gap-1.5 flex-wrap">
            {activeWeek.usesGradientPlan ? (
              <span
                className="h-2 w-6 shrink-0 rounded-full shadow-sm"
                style={{ background: MOTUS_GRADIENT }}
                title="Merka som felles gradient-program"
                aria-hidden
              />
            ) : null}
            <span>
              Uke {activeWeek.weekNumber}
              {showNowBadge && currentWeekNumber === activeWeek.weekNumber ? (
                <span className="ml-1 text-xs font-medium text-teal-700">(nå)</span>
              ) : null}
            </span>
          </div>
          {weekRange ? <div className="mt-0.5 text-[11px] text-slate-500">{weekRange}</div> : null}
          <div className="mt-0.5 text-[10px] text-slate-400">
            {activeIndex + 1} av {sortedWeeks.length}
          </div>
        </div>

        <button
          type="button"
          disabled={!canGoNext}
          onClick={() => goToIndex(activeIndex + 1)}
          className="relative z-10 inline-flex h-10 w-10 shrink-0 touch-manipulation items-center justify-center rounded-xl border bg-white text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          style={{ borderColor: "rgba(15,23,42,0.10)" }}
          aria-label="Neste uke"
        >
          <ChevronRight className="pointer-events-none h-5 w-5" aria-hidden />
        </button>
      </div>

      {sortedWeeks.length > 1 ? (
        <div
          className="flex gap-2 overflow-x-auto pb-1 scroll-smooth snap-x snap-mandatory"
          style={{ WebkitOverflowScrolling: "touch" }}
          role="tablist"
          aria-label="Velg uke i periodeplan"
        >
          {sortedWeeks.map((week, index) => {
            const selected = index === activeIndex;
            const marked = week.usesGradientPlan === true;
            const label = (
              <span className="inline-flex items-center justify-center gap-1.5">
                {marked ? (
                  <span
                    className={`h-2 w-4 shrink-0 rounded-full ${selected ? "ring-1 ring-white/80" : "ring-1 ring-slate-200"}`}
                    style={{ background: MOTUS_GRADIENT }}
                    aria-hidden
                  />
                ) : null}
                <span>
                  Uke {week.weekNumber}
                  {showNowBadge && currentWeekNumber === week.weekNumber ? " · nå" : ""}
                </span>
              </span>
            );

            const tabButtonClasses = selected
              ? "border-transparent text-white shadow-sm"
              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50";

            const innerTab = (
              <button
                key={week.id}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-label={
                  marked
                    ? `Uke ${week.weekNumber}, del av felles gradient-program`
                    : `Uke ${week.weekNumber}, egen ukedagplan`
                }
                onClick={() => goToIndex(index)}
                className={`relative z-10 w-full shrink-0 snap-start touch-manipulation rounded-xl border px-3 py-1.5 text-xs font-medium transition ${tabButtonClasses}`}
                style={selected ? { background: MOTUS_GRADIENT } : undefined}
              >
                {label}
              </button>
            );

            if (marked && !selected) {
              return (
                <div
                  key={week.id}
                  className="shrink-0 snap-start rounded-[14px] p-[2px] shadow-[0_1px_2px_rgba(15,23,42,0.06)]"
                  style={{ background: MOTUS_GRADIENT }}
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={false}
                    aria-label={`Uke ${week.weekNumber}, del av felles gradient-program`}
                    onClick={() => goToIndex(index)}
                    className="w-full rounded-[12px] border-0 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    {label}
                  </button>
                </div>
              );
            }

            return innerTab;
          })}
        </div>
      ) : null}
    </div>
  );
}
