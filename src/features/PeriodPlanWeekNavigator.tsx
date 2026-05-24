import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { MOTUS } from "../app/data";
import { imageObjectPositionFromSrc } from "../app/imageFocalPoint";
import type { PeriodPlanWeekNavItem } from "../app/periodPlanMerge";
import { PERIOD_PLAN_HERO_IMAGE } from "../app/periodPlanImagery";

export type { PeriodPlanWeekNavItem };

const MOTUS_GRADIENT = `${MOTUS.gradient}`;

type PeriodPlanWeekNavigatorProps = {
  weeks: PeriodPlanWeekNavItem[];
  selectedWeekId?: string;
  selectedWeekNumber?: number;
  onWeekSelectById?: (weekId: string) => void;
  onWeekSelectByNumber?: (weekNumber: number) => void;
  currentWeekNumber?: number | null;
  formatWeekRange?: (weekNumber: number) => string | null;
  className?: string;
  variant?: "compact" | "hero";
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
  variant = "compact",
}: PeriodPlanWeekNavigatorProps) {
  const sortedWeeks = useMemo(() => [...weeks].sort((a, b) => a.weekNumber - b.weekNumber), [weeks]);

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
  const isCurrentWeek = currentWeekNumber != null && currentWeekNumber === activeWeek.weekNumber;
  const weekProgressPct = sortedWeeks.length <= 1 ? 100 : Math.round(((activeIndex + 1) / sortedWeeks.length) * 100);

  if (variant === "hero") {
    return (
      <div className={`motus-period-plan-hero-wrap space-y-3 ${className}`.trim()}>
        <section className="motus-period-plan-hero" aria-label={`Uke ${activeWeek.weekNumber} i periodeplanen`}>
          <img
            src={PERIOD_PLAN_HERO_IMAGE}
            alt=""
            className="motus-period-plan-hero-image"
            loading="lazy"
            style={{ objectPosition: imageObjectPositionFromSrc(PERIOD_PLAN_HERO_IMAGE) }}
          />
          <div className="motus-period-plan-hero-overlay" aria-hidden />
          <div className="motus-period-plan-hero-content">
            <button
              type="button"
              disabled={!canGoPrev}
              onClick={() => goToIndex(activeIndex - 1)}
              className="motus-period-plan-hero-nav motus-period-plan-hero-nav--prev"
              aria-label="Forrige uke"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden />
            </button>

            <div className="min-w-0 flex-1 px-1 text-center sm:px-3">
              <span className="motus-period-plan-hero-badge">Uke {activeWeek.weekNumber} av {sortedWeeks.length}</span>
              <h3 className="mt-2 text-xl font-black tracking-tight text-white sm:text-2xl">
                Uke {activeWeek.weekNumber}
                {isCurrentWeek ? <span className="font-semibold text-white/90"> (nå)</span> : null}
              </h3>
              {weekRange ? <p className="mt-1 text-sm font-medium text-white/85">{weekRange}</p> : null}
              <div className="mt-4">
                <div className="motus-period-plan-hero-track">
                  <div className="motus-period-plan-hero-fill" style={{ width: `${weekProgressPct}%` }} />
                </div>
                <p className="mt-1.5 text-xs font-semibold text-white/80">
                  {activeIndex + 1} av {sortedWeeks.length} uker
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={!canGoNext}
              onClick={() => goToIndex(activeIndex + 1)}
              className="motus-period-plan-hero-nav motus-period-plan-hero-nav--next"
              aria-label="Neste uke"
            >
              <ChevronRight className="h-5 w-5" aria-hidden />
            </button>
          </div>
        </section>

        {sortedWeeks.length > 1 ? (
          <div
            className="motus-period-plan-week-tabs"
            role="tablist"
            aria-label="Velg uke i periodeplan"
          >
            {sortedWeeks.map((week, index) => {
              const selected = index === activeIndex;
              return (
                <button
                  key={week.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-label={`Uke ${week.weekNumber}`}
                  onClick={() => goToIndex(index)}
                  className={`motus-period-plan-week-tab ${selected ? "motus-period-plan-week-tab--active" : ""}`}
                >
                  Uke {week.weekNumber}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className={`relative z-10 space-y-2 ${className}`.trim()}>
      <div className="flex items-stretch gap-2">
        <button
          type="button"
          disabled={!canGoPrev}
          onClick={() => goToIndex(activeIndex - 1)}
          className="relative z-10 inline-flex h-10 w-10 shrink-0 touch-manipulation items-center justify-center rounded-lg border bg-white text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          style={{ borderColor: "rgba(15,23,42,0.10)" }}
          aria-label="Forrige uke"
        >
          <ChevronLeft className="pointer-events-none h-5 w-5" aria-hidden />
        </button>

        <div
          className="flex min-w-0 flex-1 flex-col items-center justify-center rounded-lg border px-3 py-2 text-center text-white shadow-sm"
          style={{ borderColor: "transparent", background: MOTUS_GRADIENT }}
        >
          <div className="text-sm font-semibold">
            Uke {activeWeek.weekNumber}
            {currentWeekNumber != null && currentWeekNumber === activeWeek.weekNumber ? (
              <span className="ml-1 text-xs font-medium text-white/85">(nå)</span>
            ) : null}
          </div>
          {weekRange ? <div className="mt-0.5 text-[11px] text-white/80">{weekRange}</div> : null}
          <div className="mt-0.5 text-[10px] text-white/70">
            {activeIndex + 1} av {sortedWeeks.length}
          </div>
        </div>

        <button
          type="button"
          disabled={!canGoNext}
          onClick={() => goToIndex(activeIndex + 1)}
          className="relative z-10 inline-flex h-10 w-10 shrink-0 touch-manipulation items-center justify-center rounded-lg border bg-white text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          style={{ borderColor: "rgba(15,23,42,0.10)" }}
          aria-label="Neste uke"
        >
          <ChevronRight className="pointer-events-none h-5 w-5" aria-hidden />
        </button>
      </div>

      {sortedWeeks.length > 1 ? (
        <div
          className="flex gap-1.5 overflow-x-auto pb-1 scroll-smooth snap-x snap-mandatory"
          style={{ WebkitOverflowScrolling: "touch" }}
          role="tablist"
          aria-label="Velg uke i periodeplan"
        >
          {sortedWeeks.map((week, index) => {
            const selected = index === activeIndex;
            return (
              <button
                key={week.id}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-label={`Uke ${week.weekNumber}`}
                onClick={() => goToIndex(index)}
                className={`relative z-10 shrink-0 snap-start touch-manipulation rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
                  selected
                    ? "border-transparent text-white shadow-sm"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
                style={selected ? { background: MOTUS_GRADIENT } : undefined}
              >
                Uke {week.weekNumber}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
