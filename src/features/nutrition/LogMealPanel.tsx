import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Trash2, UtensilsCrossed } from "lucide-react";
import { formatMacro } from "../../app/foodBankTypes";
import { MEMBER_MEAL_SLOTS, memberMealSlotLabel } from "../../app/memberMealSlots";
import { draftToQuickLogEntry, type MealDraftItem } from "../../app/mealDraft";
import {
  toIsoDateKey,
  type MemberMealPlanState,
  type MemberQuickFoodLogEntry,
} from "../../app/memberMealPlanState";
import { loadMemberMealPlanState } from "../../app/memberMealPlanState";
import { persistMemberMealPlanStateLocalAndScheduleCloud, syncMemberMealPlanState } from "../../app/memberMealPlanStateCloud";
import { MEAL_PLAN_STATE_CHANGED_EVENT } from "../../app/memberMealPlanState";
import type { MemberSavedMeal } from "../../app/memberSavedMeals";
import { addMemberSavedMeal, addQuickFoodLogs, removeMemberSavedMeal } from "../../app/memberMealPlanTracking";
import type { MealPlanTargets } from "../../app/mealPlanTypes";
import { GradientButton } from "../../app/ui";
import { sumQuickFoodLogMacros } from "../../app/quickFoodLogMacros";
import { DailyLoggedMacrosSummary } from "./DailyLoggedMacrosSummary";
import { MealDraftComposer } from "./MealDraftComposer";
import "../../foodbank.css";

type LogMealPanelProps = {
  memberId: string;
  mealPlanTargets?: MealPlanTargets | null;
  onRefreshFoodBank?: () => void;
  hasMealPlan?: boolean;
};

function todayKey(): string {
  return toIsoDateKey(new Date());
}

function entryMacros(entry: MemberQuickFoodLogEntry): string {
  const scale = entry.grams > 0 ? entry.grams / 100 : 0;
  return `${formatMacro(entry.nutritionPer100g.kcal * scale, 0)} kcal · P ${formatMacro(entry.nutritionPer100g.protein * scale, 1)} g`;
}

export function LogMealPanel({ memberId, mealPlanTargets, onRefreshFoodBank, hasMealPlan = false }: LogMealPanelProps) {
  const [open, setOpen] = useState(false);
  const [mealSlotId, setMealSlotId] = useState(MEMBER_MEAL_SLOTS[0]!.id);
  const [draftBySlot, setDraftBySlot] = useState<Record<string, MealDraftItem[]>>({});
  const [status, setStatus] = useState<string | null>(null);
  const [state, setState] = useState<MemberMealPlanState>(() => loadMemberMealPlanState(memberId));

  const dateKey = todayKey();
  const logsToday = state.quickFoodLogs[dateKey] ?? [];
  const hasLogs = logsToday.length > 0;
  const draftItems = draftBySlot[mealSlotId] ?? [];

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

  const macrosToday = useMemo(() => sumQuickFoodLogMacros(logsToday), [logsToday]);

  const logsBySlot = useMemo(() => {
    const grouped = new Map<string, MemberQuickFoodLogEntry[]>();
    for (const slot of MEMBER_MEAL_SLOTS) {
      grouped.set(slot.id, []);
    }
    grouped.set("other", []);
    for (const entry of logsToday) {
      const slot = entry.mealId?.trim() && grouped.has(entry.mealId) ? entry.mealId : "other";
      grouped.get(slot)!.push(entry);
    }
    return grouped;
  }, [logsToday]);

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
    const entries = draftItems.map((item) => draftToQuickLogEntry(item, mealSlotId));
    const next = addQuickFoodLogs(memberId, state, dateKey, entries);
    setState(next);
    setDraftForSlot(mealSlotId, []);
    const slotLabel = memberMealSlotLabel(mealSlotId);
    setStatus(`${draftItems.length} ${draftItems.length === 1 ? "vare" : "varer"} logget til ${slotLabel.toLowerCase()}.`);
    setOpen(hasLogs || draftItems.length > 1);
  }, [dateKey, draftItems, hasLogs, mealSlotId, memberId, setDraftForSlot, state]);

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
    (entryId: string) => {
      const nextLogs = logsToday.filter((entry) => entry.id !== entryId);
      persistState({
        ...state,
        quickFoodLogs: { ...state.quickFoodLogs, [dateKey]: nextLogs },
        updatedAt: new Date().toISOString(),
      });
    },
    [dateKey, logsToday, persistState, state],
  );

  if (!open && !hasLogs) {
    return (
      <div className="motus-log-meal-hero">
        <div className="motus-log-meal-hero__icon" aria-hidden>
          <UtensilsCrossed className="h-7 w-7" />
        </div>
        <h2 className="motus-log-meal-hero__title">Logg det du spiser</h2>
        <p className="motus-log-meal-hero__lead">
          {hasMealPlan
            ? "Bygg måltidet med matvarer du legger til — se listen underveis. Logg eller lagre favoritten når du er ferdig."
            : "Bygg måltidet med matvarer du legger til — se listen underveis. Logg eller lagre favoritten når du er ferdig."}
        </p>
        <GradientButton type="button" className="motus-log-meal-cta" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" aria-hidden />
          Logg et måltid
        </GradientButton>
      </div>
    );
  }

  return (
    <div className="motus-log-meal-panel">
      {hasLogs && !hasMealPlan ? (
        <DailyLoggedMacrosSummary macros={macrosToday} targets={mealPlanTargets} title="I dag totalt" />
      ) : null}

      {hasLogs && !open ? (
        <section className="motus-log-meal-panel__summary" aria-label="Logget i dag">
          <header className="motus-log-meal-panel__summary-head">
            <div className="motus-log-meal-panel__summary-title-wrap">
              <span className="motus-log-meal-panel__summary-icon" aria-hidden>
                <UtensilsCrossed className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <h2 className="motus-log-meal-panel__title">Logget i dag</h2>
                <p className="motus-log-meal-panel__summary-sub">
                  {logsToday.length} {logsToday.length === 1 ? "post" : "poster"} · {formatMacro(macrosToday.kcal, 0)} kcal
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
                  <ul className="motus-log-meal-panel__list">
                    {entries.map((entry) => (
                      <li key={entry.id} className="motus-log-meal-panel__item">
                        <div className="min-w-0">
                          <p className="motus-log-meal-panel__item-name">
                            {entry.name} · {formatMacro(entry.grams, 0)} g
                          </p>
                          <p className="motus-log-meal-panel__item-meta">{entryMacros(entry)}</p>
                        </div>
                        <button
                          type="button"
                          className="motus-log-meal-panel__remove"
                          onClick={() => removeLog(entry.id)}
                          aria-label={`Fjern ${entry.name}`}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </button>
                      </li>
                    ))}
                  </ul>
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
                <ul className="motus-log-meal-panel__list">
                  {(logsBySlot.get("other") ?? []).map((entry) => (
                    <li key={entry.id} className="motus-log-meal-panel__item">
                      <div className="min-w-0">
                        <p className="motus-log-meal-panel__item-name">
                          {entry.name} · {formatMacro(entry.grams, 0)} g
                        </p>
                        <p className="motus-log-meal-panel__item-meta">{entryMacros(entry)}</p>
                      </div>
                      <button
                        type="button"
                        className="motus-log-meal-panel__remove"
                        onClick={() => removeLog(entry.id)}
                        aria-label={`Fjern ${entry.name}`}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
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
          />
        </div>
      ) : null}

      {status ? <p className="motus-log-meal-panel__status">{status}</p> : null}
    </div>
  );
}
