import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download, FileText } from "lucide-react";
import { formatMacro } from "../../app/foodBankTypes";
import { formatMicronutrientValue } from "../../app/foodBankMicronutrients";
import { HEALTH_DIRECTORATE_OTHER_DAILY } from "../../app/healthDirectorateNutritionReferences";
import { buildMemberFoodLogCsvReport, downloadMemberFoodLogCsv } from "../../app/memberFoodLogReport";
import { MEMBER_MEAL_SLOTS, memberMealSlotLabel } from "../../app/memberMealSlots";
import { toIsoDateKey, type MemberQuickFoodLogEntry } from "../../app/memberMealPlanState";
import { loadMemberMealPlanState } from "../../app/memberMealPlanState";
import { syncMemberMealPlanState } from "../../app/memberMealPlanStateCloud";
import { MEAL_PLAN_STATE_CHANGED_EVENT } from "../../app/memberMealPlanState";
import {
  micronutrientRowsFromLogTotals,
  sumQuickFoodLogNutrition,
} from "../../app/quickFoodLogNutrition";
import type { MealPlanTargets } from "../../app/mealPlanTypes";
import { Card, OutlineButton } from "../../app/ui";
import { DailyLoggedMacrosSummary } from "./DailyLoggedMacrosSummary";
import { MacroProgressBar } from "./MacroProgressBar";
import "../../foodbank.css";

type MemberFoodLogTrainerViewProps = {
  memberId: string;
  memberName: string;
  mealPlanTargets?: MealPlanTargets | null;
  onRefreshFoodBank?: () => void;
};

function todayKey(): string {
  return toIsoDateKey(new Date());
}

function formatDateKeyLabel(dateKey: string): string {
  const parts = dateKey.split("-");
  if (parts.length !== 3) return dateKey;
  const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  const today = todayKey();
  const base = date.toLocaleDateString("nb-NO", { weekday: "short", day: "numeric", month: "short" });
  return dateKey === today ? `I dag · ${base}` : base;
}

function groupLogsByMealSlot(logs: MemberQuickFoodLogEntry[]): Map<string, MemberQuickFoodLogEntry[]> {
  const grouped = new Map<string, MemberQuickFoodLogEntry[]>();
  for (const slot of MEMBER_MEAL_SLOTS) {
    grouped.set(slot.id, []);
  }
  grouped.set("other", []);
  for (const entry of logs) {
    const slotId = entry.mealId?.trim() && grouped.has(entry.mealId) ? entry.mealId : "other";
    grouped.get(slotId)!.push(entry);
  }
  return grouped;
}

function entryMacroLine(entry: MemberQuickFoodLogEntry): string {
  const scale = entry.grams > 0 ? entry.grams / 100 : 0;
  const n = entry.nutritionPer100g;
  return `${formatMacro(n.kcal * scale, 0)} kcal · P ${formatMacro(n.protein * scale, 1)} · K ${formatMacro(n.carbs * scale, 1)} · F ${formatMacro(n.fat * scale, 1)} g`;
}

export function MemberFoodLogTrainerView({
  memberId,
  memberName,
  mealPlanTargets,
  onRefreshFoodBank,
}: MemberFoodLogTrainerViewProps) {
  const displayName = memberName.trim() || "Kunden";
  const [state, setState] = useState(() => loadMemberMealPlanState(memberId));
  const [selectedDateKey, setSelectedDateKey] = useState(todayKey);
  const [reportStatus, setReportStatus] = useState<string | null>(null);

  useEffect(() => {
    onRefreshFoodBank?.();
  }, [onRefreshFoodBank]);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      const synced = await syncMemberMealPlanState(memberId);
      if (mounted) setState(synced);
    })();
    return () => {
      mounted = false;
    };
  }, [memberId]);

  useEffect(() => {
    const handler = () => setState(loadMemberMealPlanState(memberId));
    window.addEventListener(MEAL_PLAN_STATE_CHANGED_EVENT, handler);
    return () => window.removeEventListener(MEAL_PLAN_STATE_CHANGED_EVENT, handler);
  }, [memberId]);

  const availableDateKeys = useMemo(() => {
    const keys = Object.keys(state.quickFoodLogs).filter((key) => (state.quickFoodLogs[key]?.length ?? 0) > 0);
    if (!keys.includes(todayKey())) keys.unshift(todayKey());
    return [...new Set(keys)].sort((a, b) => b.localeCompare(a));
  }, [state.quickFoodLogs]);

  useEffect(() => {
    if (!availableDateKeys.includes(selectedDateKey) && availableDateKeys.length > 0) {
      setSelectedDateKey(availableDateKeys[0]!);
    }
  }, [availableDateKeys, selectedDateKey]);

  const logs = state.quickFoodLogs[selectedDateKey] ?? [];
  const totals = useMemo(() => sumQuickFoodLogNutrition(logs), [logs]);
  const microRows = useMemo(() => micronutrientRowsFromLogTotals(totals), [totals]);
  const logsBySlot = useMemo(() => groupLogsByMealSlot(logs), [logs]);
  const hasMicronutrientData = microRows.some((row) => row.value > 0);

  const selectedDateIndex = availableDateKeys.indexOf(selectedDateKey);

  const shiftDate = useCallback(
    (delta: number) => {
      const nextIndex = selectedDateIndex + delta;
      if (nextIndex < 0 || nextIndex >= availableDateKeys.length) return;
      setSelectedDateKey(availableDateKeys[nextIndex]!);
    },
    [availableDateKeys, selectedDateIndex],
  );

  const downloadReport = useCallback(() => {
    const csv = buildMemberFoodLogCsvReport({
      memberName: displayName,
      dateKey: selectedDateKey,
      logs,
      totals,
    });
    const safeName = displayName.replace(/[^\wæøåÆØÅ-]+/gi, "-").replace(/-+/g, "-") || "kunde";
    downloadMemberFoodLogCsv(`matlogg-${safeName}-${selectedDateKey}.csv`, csv);
    setReportStatus("Rapport lastet ned.");
    window.setTimeout(() => setReportStatus(null), 4000);
  }, [displayName, logs, selectedDateKey, totals]);

  const macroTargets = mealPlanTargets ?? null;

  return (
    <Card className="motus-trainer-food-log p-4 space-y-4">
      <div className="motus-trainer-food-log__head">
        <div className="min-w-0">
          <h3 className="motus-trainer-food-log__title">{displayName} sin matlogg</h3>
          <p className="motus-trainer-food-log__lead">Det kunden har logget, gruppert på måltidstype.</p>
        </div>
        <div className="motus-trainer-food-log__actions">
          <OutlineButton type="button" className="text-xs gap-1.5" onClick={downloadReport} disabled={!logs.length}>
            <Download className="h-4 w-4" aria-hidden />
            Last ned rapport
          </OutlineButton>
        </div>
      </div>

      <div className="motus-trainer-food-log__date-nav">
        <button
          type="button"
          className="motus-trainer-food-log__date-btn motus-pressable"
          onClick={() => shiftDate(1)}
          disabled={selectedDateIndex >= availableDateKeys.length - 1}
          aria-label="Forrige dag med logger"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </button>
        <label className="motus-trainer-food-log__date-picker">
          <span className="sr-only">Velg dato</span>
          <select
            value={selectedDateKey}
            onChange={(e) => setSelectedDateKey(e.target.value)}
            className="motus-trainer-food-log__date-select"
          >
            {availableDateKeys.map((key) => (
              <option key={key} value={key}>
                {formatDateKeyLabel(key)} ({state.quickFoodLogs[key]?.length ?? 0} poster)
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="motus-trainer-food-log__date-btn motus-pressable"
          onClick={() => shiftDate(-1)}
          disabled={selectedDateIndex <= 0}
          aria-label="Neste dag med logger"
        >
          <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
      </div>

      {reportStatus ? <p className="text-xs font-medium text-teal-700">{reportStatus}</p> : null}

      {!logs.length ? (
        <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          Ingen matlogg registrert denne dagen.
        </p>
      ) : (
        <>
          <DailyLoggedMacrosSummary macros={totals} targets={macroTargets} title={`${formatDateKeyLabel(selectedDateKey)} — totalt`} />

          <section className="motus-trainer-food-log__section" aria-label="Makro og fiber">
            <h4 className="motus-trainer-food-log__section-title">Makro og øvrig</h4>
            {macroTargets?.protein || macroTargets?.carbs || macroTargets?.fat ? (
              <div className="motus-trainer-food-log__macro-bars">
                {macroTargets.protein ? (
                  <MacroProgressBar label="Protein" current={totals.protein} target={macroTargets.protein} />
                ) : null}
                {macroTargets.carbs ? (
                  <MacroProgressBar label="Karbohydrater" current={totals.carbs} target={macroTargets.carbs} />
                ) : null}
                {macroTargets.fat ? (
                  <MacroProgressBar label="Fett" current={totals.fat} target={macroTargets.fat} />
                ) : null}
              </div>
            ) : null}
            <ul className="motus-trainer-food-log__extra-macros">
              <li>
                <span>Fiber</span>
                <strong>
                  {formatMacro(totals.fiber, 1)} g
                  <span className="text-slate-500 font-normal">
                    {" "}
                    / {HEALTH_DIRECTORATE_OTHER_DAILY.fiber} g ref.
                  </span>
                </strong>
              </li>
              <li>
                <span>Sukker</span>
                <strong>{formatMacro(totals.sugar, 1)} g</strong>
              </li>
              <li>
                <span>Mettet fett</span>
                <strong>
                  {formatMacro(totals.saturatedFat, 1)} g
                  <span className="text-slate-500 font-normal">
                    {" "}
                    / {HEALTH_DIRECTORATE_OTHER_DAILY.saturatedFat} g ref.
                  </span>
                </strong>
              </li>
              <li>
                <span>Natrium</span>
                <strong>
                  {formatMacro(totals.sodium, 0)} mg
                  <span className="text-slate-500 font-normal">
                    {" "}
                    / {HEALTH_DIRECTORATE_OTHER_DAILY.sodium} mg maks ref.
                  </span>
                </strong>
              </li>
            </ul>
          </section>

          <section className="motus-trainer-food-log__section" aria-label="Måltider">
            <h4 className="motus-trainer-food-log__section-title">Per måltid</h4>
            <div className="motus-trainer-food-log__meals">
              {MEMBER_MEAL_SLOTS.map((slot) => {
                const entries = logsBySlot.get(slot.id) ?? [];
                if (!entries.length) return null;
                const slotTotals = sumQuickFoodLogNutrition(entries);
                return (
                  <article key={slot.id} className="motus-trainer-food-log__meal-group">
                    <header className="motus-trainer-food-log__meal-head">
                      <h5 className="motus-trainer-food-log__meal-title">{slot.label}</h5>
                      <span className="motus-trainer-food-log__meal-sum">
                        {formatMacro(slotTotals.kcal, 0)} kcal · P {formatMacro(slotTotals.protein, 0)} g
                      </span>
                    </header>
                    <ul className="motus-trainer-food-log__items">
                      {entries.map((entry) => (
                        <li key={entry.id} className="motus-trainer-food-log__item">
                          <p className="motus-trainer-food-log__item-name">
                            {entry.name} · {formatMacro(entry.grams, 0)} g
                          </p>
                          <p className="motus-trainer-food-log__item-meta">{entryMacroLine(entry)}</p>
                        </li>
                      ))}
                    </ul>
                  </article>
                );
              })}
              {(logsBySlot.get("other") ?? []).length > 0 ? (
                <article className="motus-trainer-food-log__meal-group">
                  <header className="motus-trainer-food-log__meal-head">
                    <h5 className="motus-trainer-food-log__meal-title">{memberMealSlotLabel("other")}</h5>
                  </header>
                  <ul className="motus-trainer-food-log__items">
                    {(logsBySlot.get("other") ?? []).map((entry) => (
                      <li key={entry.id} className="motus-trainer-food-log__item">
                        <p className="motus-trainer-food-log__item-name">
                          {entry.name} · {formatMacro(entry.grams, 0)} g
                        </p>
                        <p className="motus-trainer-food-log__item-meta">{entryMacroLine(entry)}</p>
                      </li>
                    ))}
                  </ul>
                </article>
              ) : null}
            </div>
          </section>

          <section className="motus-trainer-food-log__section" aria-label="Mikronæringsstoffer">
            <div className="motus-trainer-food-log__section-head">
              <h4 className="motus-trainer-food-log__section-title">
                <FileText className="inline h-4 w-4 -mt-0.5 mr-1" aria-hidden />
                Mikronæringsstoffer
              </h4>
              <p className="motus-trainer-food-log__section-hint">Vs. generelle daglige referanser (Helsedirektoratet)</p>
            </div>
            {!hasMicronutrientData ? (
              <p className="text-sm text-slate-500">
                Ingen mikronæringsdata i loggene denne dagen. Data fylles når matvarer i matbanken har vitaminer og mineraler.
              </p>
            ) : (
              <div className="motus-trainer-food-log__micro-table-wrap">
                <table className="motus-trainer-food-log__micro-table">
                  <thead>
                    <tr>
                      <th scope="col">Stoff</th>
                      <th scope="col">Inntatt</th>
                      <th scope="col">Referanse</th>
                      <th scope="col">Dekning</th>
                    </tr>
                  </thead>
                  <tbody>
                    {microRows.map((row) => {
                      if (row.value <= 0) return null;
                      return (
                        <tr key={row.key}>
                          <td>{row.label}</td>
                          <td>
                            {formatMicronutrientValue(row.value, row.decimals)} {row.unit}
                          </td>
                          <td>
                            {formatMicronutrientValue(row.target, row.decimals)} {row.unit}
                          </td>
                          <td>
                            <span
                              className={`motus-trainer-food-log__micro-pct ${row.coveragePct >= 100 ? "is-high" : row.coveragePct >= 50 ? "is-mid" : ""}`}
                            >
                              {formatMacro(row.coveragePct, 0)}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </Card>
  );
}
