import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, UtensilsCrossed } from "lucide-react";
import { formatMacro } from "../../app/foodBankTypes";
import { MEMBER_MEAL_SLOTS, memberMealSlotLabel } from "../../app/memberMealSlots";
import { draftToQuickLogEntry, type MealDraftItem } from "../../app/mealDraft";
import { resolveNutritionFromFoodItems } from "../../app/memberNutritionRehydrate";
import {
  toIsoDateKey,
  type MemberMealPlanState,
  type MemberQuickFoodLogEntry,
} from "../../app/memberMealPlanState";
import { loadMemberMealPlanState } from "../../app/memberMealPlanState";
import { persistMemberMealPlanStateLocalAndScheduleCloud, syncMemberMealPlanState } from "../../app/memberMealPlanStateCloud";
import { MEAL_PLAN_STATE_CHANGED_EVENT } from "../../app/memberMealPlanState";
import type { MemberSavedMeal } from "../../app/memberSavedMeals";
import { addMemberSavedMeal, addQuickFoodLogs, removeMemberSavedMeal, updateQuickFoodLog } from "../../app/memberMealPlanTracking";
import type { MealPlanTargets } from "../../app/mealPlanTypes";
import { useFoodBankItems } from "../../app/useFoodBankItems";
import { GradientButton } from "../../app/ui";
import { sumQuickFoodLogMacros } from "../../app/quickFoodLogMacros";
import { DailyLoggedMacrosSummary } from "./DailyLoggedMacrosSummary";
import { LoggedQuickFoodEntryRow } from "./LoggedQuickFoodEntryRow";
import { MealDraftComposer } from "./MealDraftComposer";
import { computeTotalWaterLiters, MemberWaterIntakeSection } from "./MemberWaterIntakeSection";
import "../../foodbank.css";

/** How far back members may backfill meal logs. */
const FOOD_LOG_LOOKBACK_DAYS = 14;

type LogMealPanelProps = {
  memberId: string;
  mealPlanTargets?: MealPlanTargets | null;
  onRefreshFoodBank?: () => void;
  hasMealPlan?: boolean;
  /** Vann logges nederst i matplan-dashboard; skjul her for å unngå duplikat. */
  showWaterSection?: boolean;
  planFoodWaterLiters?: number;
  /** Synkroniser logg-dato med valgt matplan-dag når satt. */
  preferredDateKey?: string;
};

function todayKey(): string {
  return toIsoDateKey(new Date());
}

function shiftDateKey(dateKey: string, deltaDays: number): string {
  const parts = dateKey.split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return todayKey();
  const date = new Date(parts[0]!, parts[1]! - 1, parts[2]!);
  date.setDate(date.getDate() + deltaDays);
  return toIsoDateKey(date);
}

function minLogDateKey(): string {
  return shiftDateKey(todayKey(), -FOOD_LOG_LOOKBACK_DAYS);
}

function clampLogDateKey(dateKey: string): string {
  const today = todayKey();
  const min = minLogDateKey();
  if (dateKey > today) return today;
  if (dateKey < min) return min;
  return dateKey;
}

function formatLogDateLabel(dateKey: string): string {
  const parts = dateKey.split("-");
  if (parts.length !== 3) return dateKey;
  const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  const base = date.toLocaleDateString("nb-NO", { weekday: "short", day: "numeric", month: "short" });
  return dateKey === todayKey() ? `I dag · ${base}` : base;
}

export function LogMealPanel({
  memberId,
  mealPlanTargets,
  onRefreshFoodBank,
  hasMealPlan = false,
  showWaterSection = true,
  planFoodWaterLiters = 0,
  preferredDateKey,
}: LogMealPanelProps) {
  const foodItems = useFoodBankItems();
  const [open, setOpen] = useState(false);
  const [mealSlotId, setMealSlotId] = useState(MEMBER_MEAL_SLOTS[0]!.id);
  const [draftBySlot, setDraftBySlot] = useState<Record<string, MealDraftItem[]>>({});
  const [status, setStatus] = useState<string | null>(null);
  const [state, setState] = useState<MemberMealPlanState>(() => loadMemberMealPlanState(memberId));
  const [dateKey, setDateKey] = useState(() =>
    clampLogDateKey(preferredDateKey?.trim() || todayKey()),
  );

  const logsForDate = state.quickFoodLogs[dateKey] ?? [];
  const hasLogs = logsForDate.length > 0;
  const draftItems = draftBySlot[mealSlotId] ?? [];
  const isToday = dateKey === todayKey();
  const dateLabel = formatLogDateLabel(dateKey);
  const canGoBack = dateKey > minLogDateKey();
  const canGoForward = dateKey < todayKey();

  useEffect(() => {
    const preferred = preferredDateKey?.trim();
    if (!preferred) return;
    setDateKey(clampLogDateKey(preferred));
  }, [preferredDateKey]);

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

  const macrosForDate = useMemo(() => sumQuickFoodLogMacros(logsForDate), [logsForDate]);
  const totalWaterForDateLiters = useMemo(
    () => computeTotalWaterLiters(state, dateKey, foodItems, planFoodWaterLiters),
    [dateKey, foodItems, planFoodWaterLiters, state],
  );
  const logsBySlot = useMemo(() => {
    const grouped = new Map<string, MemberQuickFoodLogEntry[]>();
    for (const slot of MEMBER_MEAL_SLOTS) {
      grouped.set(slot.id, []);
    }
    grouped.set("other", []);
    for (const entry of logsForDate) {
      const slot = entry.mealId?.trim() && grouped.has(entry.mealId) ? entry.mealId : "other";
      grouped.get(slot)!.push(entry);
    }
    return grouped;
  }, [logsForDate]);

  const setDraftForSlot = useCallback((slotId: string, items: MealDraftItem[]) => {
    setDraftBySlot((prev) => ({ ...prev, [slotId]: items }));
  }, []);

  const persistState = useCallback(
    (nextState: MemberMealPlanState) => {
      setState(nextState);
      persistMemberMealPlanStateLocalAndScheduleCloud(memberId, nextState);
    },
    [memberId],
  );

  const handleCommitLog = useCallback(() => {
    if (!draftItems.length) return;
    const entries = draftItems.map((item) => {
      const nutritionPer100g = resolveNutritionFromFoodItems(item.name, item.nutritionPer100g, foodItems, item.foodId);
      return draftToQuickLogEntry({ ...item, nutritionPer100g }, mealSlotId);
    });
    const next = addQuickFoodLogs(memberId, state, dateKey, entries);
    setState(next);
    setDraftForSlot(mealSlotId, []);
    const slotLabel = memberMealSlotLabel(mealSlotId);
    const when = isToday ? "" : ` (${dateLabel})`;
    setStatus(
      `${draftItems.length} ${draftItems.length === 1 ? "vare" : "varer"} logget til ${slotLabel.toLowerCase()}${when}.`,
    );
    setOpen(hasLogs || draftItems.length > 1);
  }, [
    dateKey,
    dateLabel,
    draftItems,
    foodItems,
    hasLogs,
    isToday,
    mealSlotId,
    memberId,
    setDraftForSlot,
    state,
  ]);

  const handleSaveTemplate = useCallback(
    (meal: MemberSavedMeal) => {
      const next = addMemberSavedMeal(memberId, state, meal);
      setState(next);
      setStatus(`«${meal.name}» er lagret til senere bruk.`);
    },
    [memberId, state],
  );

  const handleDeleteSaved = useCallback(
    (savedMealId: string) => {
      const next = removeMemberSavedMeal(memberId, state, savedMealId);
      setState(next);
      setStatus("Lagret måltid er fjernet.");
    },
    [memberId, state],
  );

  const removeLog = useCallback(
    (entry: MemberQuickFoodLogEntry) => {
      const confirmRemove = window.confirm(`Vil du fjerne ${entry.name}?`);
      if (!confirmRemove) return;
      const nextLogs = logsForDate.filter((row) => row.id !== entry.id);
      persistState({
        ...state,
        quickFoodLogs: { ...state.quickFoodLogs, [dateKey]: nextLogs },
        updatedAt: new Date().toISOString(),
      });
    },
    [dateKey, logsForDate, persistState, state],
  );

  const saveLogEdit = useCallback(
    (entry: MemberQuickFoodLogEntry, patch: { grams: number; mealId: string }) => {
      const next = updateQuickFoodLog(memberId, state, dateKey, entry.id, patch);
      setState(next);
      setStatus(`Oppdatert ${entry.name}.`);
    },
    [dateKey, memberId, state],
  );

  const renderLogEntries = (entries: MemberQuickFoodLogEntry[]) =>
    entries.map((entry) => (
      <LoggedQuickFoodEntryRow
        key={entry.id}
        entry={entry}
        onSave={(patch) => saveLogEdit(entry, patch)}
        onRemove={() => removeLog(entry)}
      />
    ));

  const dateNav = (
    <div className="motus-log-meal-panel__date-nav" role="group" aria-label="Velg dag for matlogg">
      <button
        type="button"
        className="motus-log-meal-panel__date-btn motus-pressable"
        onClick={() => setDateKey((prev) => clampLogDateKey(shiftDateKey(prev, -1)))}
        disabled={!canGoBack}
        aria-label="Forrige dag"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
      </button>
      <label className="motus-log-meal-panel__date-picker">
        <span className="motus-log-meal-panel__date-label">{dateLabel}</span>
        <input
          type="date"
          className="motus-log-meal-panel__date-input"
          value={dateKey}
          min={minLogDateKey()}
          max={todayKey()}
          aria-label="Dato for måltid"
          onChange={(e) => {
            const next = e.target.value.trim();
            if (next) setDateKey(clampLogDateKey(next));
          }}
        />
      </label>
      <button
        type="button"
        className="motus-log-meal-panel__date-btn motus-pressable"
        onClick={() => setDateKey((prev) => clampLogDateKey(shiftDateKey(prev, 1)))}
        disabled={!canGoForward}
        aria-label="Neste dag"
      >
        <ChevronRight className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );

  if (!open && !hasLogs) {
    return (
      <div className="motus-log-meal-panel motus-log-meal-panel--intro">
        {dateNav}
        <div className="motus-log-meal-hero">
          <div className="motus-log-meal-hero__icon" aria-hidden>
            <UtensilsCrossed className="h-7 w-7" />
          </div>
          <h2 className="motus-log-meal-hero__title">Logg det du spiser</h2>
          <p className="motus-log-meal-hero__lead">
            Bygg måltidet med matvarer du legger til — se listen underveis. Glemte du noe i går? Velg dato over og logg
            tilbake i tid.
          </p>
          <GradientButton type="button" className="motus-log-meal-cta" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden />
            Logg et måltid
          </GradientButton>
        </div>
        {showWaterSection ? (
          <MemberWaterIntakeSection
            memberId={memberId}
            dateKey={dateKey}
            foodItems={foodItems}
            planFoodWaterLiters={planFoodWaterLiters}
            className="motus-log-meal-panel__water"
          />
        ) : null}
      </div>
    );
  }

  return (
    <div className="motus-log-meal-panel">
      {dateNav}

      {hasLogs && !hasMealPlan ? (
        <DailyLoggedMacrosSummary
          macros={macrosForDate}
          targets={mealPlanTargets}
          title={`${dateLabel} — totalt`}
          totalWaterLiters={totalWaterForDateLiters}
        />
      ) : null}

      {hasLogs && !open ? (
        <section className="motus-log-meal-panel__summary" aria-label={`Logget ${dateLabel}`}>
          <header className="motus-log-meal-panel__summary-head">
            <div className="motus-log-meal-panel__summary-title-wrap">
              <span className="motus-log-meal-panel__summary-icon" aria-hidden>
                <UtensilsCrossed className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <h2 className="motus-log-meal-panel__title">Logget {isToday ? "i dag" : dateLabel}</h2>
                <p className="motus-log-meal-panel__summary-sub">
                  {logsForDate.length} {logsForDate.length === 1 ? "post" : "poster"} · {formatMacro(macrosForDate.kcal, 0)}{" "}
                  kcal
                </p>
              </div>
            </div>
            <GradientButton type="button" className="motus-log-meal-cta motus-log-meal-cta--compact" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" aria-hidden />
              Logg et måltid
            </GradientButton>
          </header>
          <div className="motus-log-meal-panel__groups">
            {MEMBER_MEAL_SLOTS.map((slot) => {
              const entries = logsBySlot.get(slot.id) ?? [];
              if (!entries.length) return null;
              const slotMacros = sumQuickFoodLogMacros(entries);
              return (
                <article key={slot.id} className="motus-log-meal-panel__meal-group">
                  <header className="motus-log-meal-panel__meal-head">
                    <h3 className="motus-log-meal-panel__meal-title">{slot.label}</h3>
                    <span className="motus-log-meal-panel__meal-sum">
                      {formatMacro(slotMacros.kcal, 0)} kcal · P {formatMacro(slotMacros.protein, 0)} g
                    </span>
                  </header>
                  <ul className="motus-log-meal-panel__list">{renderLogEntries(entries)}</ul>
                </article>
              );
            })}
            {(logsBySlot.get("other") ?? []).length > 0 ? (
              <article className="motus-log-meal-panel__meal-group motus-log-meal-panel__meal-group--other">
                <header className="motus-log-meal-panel__meal-head">
                  <h3 className="motus-log-meal-panel__meal-title">Annet</h3>
                  <span className="motus-log-meal-panel__meal-sum">
                    {formatMacro(sumQuickFoodLogMacros(logsBySlot.get("other")).kcal, 0)} kcal
                  </span>
                </header>
                <ul className="motus-log-meal-panel__list">{renderLogEntries(logsBySlot.get("other") ?? [])}</ul>
              </article>
            ) : null}
          </div>
        </section>
      ) : null}

      {open || !hasLogs ? (
        <div className="motus-log-meal-panel__form-wrap">
          {hasLogs ? (
            <div className="motus-log-meal-panel__form-head">
              <h2 className="motus-log-meal-panel__title">Logg et måltid</h2>
              <button type="button" className="motus-log-meal-panel__close motus-pressable" onClick={() => setOpen(false)}>
                Lukk
              </button>
            </div>
          ) : null}

          {!isToday ? (
            <p className="motus-log-meal-panel__backfill-hint">Logger til {dateLabel}</p>
          ) : null}

          <p className="motus-log-meal-panel__step-label">1. Velg måltid</p>
          <div className="motus-log-meal-panel__slots" role="tablist" aria-label="Måltidstype">
            {MEMBER_MEAL_SLOTS.map((slot) => (
              <button
                key={slot.id}
                type="button"
                role="tab"
                aria-selected={mealSlotId === slot.id}
                className={`motus-log-meal-panel__slot ${mealSlotId === slot.id ? "motus-log-meal-panel__slot--active" : ""}`}
                onClick={() => setMealSlotId(slot.id)}
              >
                {slot.label}
                {(draftBySlot[slot.id]?.length ?? 0) > 0 ? (
                  <span className="motus-log-meal-panel__slot-badge">{draftBySlot[slot.id]!.length}</span>
                ) : null}
              </button>
            ))}
          </div>

          <MealDraftComposer
            mealSlotId={mealSlotId}
            mealSlotLabel={memberMealSlotLabel(mealSlotId)}
            draftItems={draftItems}
            onDraftChange={(items) => setDraftForSlot(mealSlotId, items)}
            savedMeals={state.savedMeals ?? []}
            onSaveTemplate={handleSaveTemplate}
            onDeleteSaved={handleDeleteSaved}
            onCommitLog={handleCommitLog}
            foodItems={foodItems}
          />
        </div>
      ) : null}

      {showWaterSection ? (
        <MemberWaterIntakeSection
          memberId={memberId}
          dateKey={dateKey}
          foodItems={foodItems}
          planFoodWaterLiters={planFoodWaterLiters}
          className="motus-log-meal-panel__water"
        />
      ) : null}

      {status ? <p className="motus-log-meal-panel__status">{status}</p> : null}
    </div>
  );
}
