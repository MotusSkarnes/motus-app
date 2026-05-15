import { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { MOTUS } from "../app/data";

export type PeriodPlanWeekNavItem = {
  id: string;
  weekNumber: number;
};

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

  const selectedIndex = useMemo(() => {
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

  if (!sortedWeeks.length) return null;

  const activeWeek = sortedWeeks[selectedIndex] ?? sortedWeeks[0];
  const weekRange = formatWeekRange?.(activeWeek.weekNumber) ?? null;
  const canGoPrev = selectedIndex > 0;
  const canGoNext = selectedIndex < sortedWeeks.length - 1;
  const showNowBadge = currentWeekNumber != null;

  function selectWeek(week: PeriodPlanWeekNavItem) {
    onWeekSelectById?.(week.id);
    onWeekSelectByNumber?.(Number(week.weekNumber));
  }

  return (
    <div className={`space-y-2 ${className}`.trim()}>
      <div className="flex items-stretch gap-2">
        <button
          type="button"
          disabled={!canGoPrev}
          onClick={() => selectWeek(sortedWeeks[selectedIndex - 1])}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border bg-white text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          style={{ borderColor: "rgba(15,23,42,0.10)" }}
          aria-label="Forrige uke"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </button>

        <div
          className="flex min-w-0 flex-1 flex-col items-center justify-center rounded-xl border bg-white px-3 py-2 text-center"
          style={{ borderColor: "rgba(15,23,42,0.10)" }}
        >
          <div className="text-sm font-semibold text-slate-800">
            Uke {activeWeek.weekNumber}
            {showNowBadge && currentWeekNumber === activeWeek.weekNumber ? (
              <span className="ml-1 text-xs font-medium text-teal-700">(nå)</span>
            ) : null}
          </div>
          {weekRange ? <div className="mt-0.5 text-[11px] text-slate-500">{weekRange}</div> : null}
          <div className="mt-0.5 text-[10px] text-slate-400">
            {selectedIndex + 1} av {sortedWeeks.length}
          </div>
        </div>

        <button
          type="button"
          disabled={!canGoNext}
          onClick={() => selectWeek(sortedWeeks[selectedIndex + 1])}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border bg-white text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          style={{ borderColor: "rgba(15,23,42,0.10)" }}
          aria-label="Neste uke"
        >
          <ChevronRight className="h-5 w-5" aria-hidden />
        </button>
      </div>

      {sortedWeeks.length > 1 ? (
        <div
          className="flex gap-2 overflow-x-auto pb-1 scroll-smooth snap-x snap-mandatory"
          style={{ WebkitOverflowScrolling: "touch" }}
          role="tablist"
          aria-label="Velg uke i periodeplan"
        >
          {sortedWeeks.map((week) => {
            const selected = week.id === activeWeek.id;
            return (
              <button
                key={week.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => selectWeek(week)}
                className={`shrink-0 snap-start rounded-xl border px-3 py-1.5 text-xs font-medium transition ${
                  selected ? "border-transparent text-white shadow-sm" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
                style={
                  selected ? { background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` } : undefined
                }
              >
                Uke {week.weekNumber}
                {showNowBadge && currentWeekNumber === week.weekNumber ? " · nå" : ""}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
