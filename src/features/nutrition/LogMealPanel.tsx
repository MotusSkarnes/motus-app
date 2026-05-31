import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2, UtensilsCrossed } from "lucide-react";
import { formatMacro } from "../../app/foodBankTypes";
import { MEMBER_MEAL_SLOTS, memberMealSlotLabel } from "../../app/memberMealSlots";
import {
  mergeMemberMealPlanStates,
  toIsoDateKey,
  type MemberMealPlanState,
  type MemberQuickFoodLogEntry,
} from "../../app/memberMealPlanState";
import { loadMemberMealPlanState } from "../../app/memberMealPlanState";
import { syncMemberMealPlanState } from "../../app/memberMealPlanStateCloud";
import { MEAL_PLAN_STATE_CHANGED_EVENT } from "../../app/memberMealPlanState";
import type { MealPlanTargets } from "../../app/mealPlanTypes";
import { GradientButton } from "../../app/ui";
import { sumQuickFoodLogMacros } from "../../app/quickFoodLogMacros";
import { addQuickFoodLog, removeQuickFoodLog } from "../../app/memberMealPlanTracking";
import { DailyLoggedMacrosSummary } from "./DailyLoggedMacrosSummary";
import { FoodLogFormFields, type FoodLogDraft } from "./FoodLogFormFields";
import "../../foodbank.css";

type LogMealPanelProps = {
  memberId: string;
  mealPlanTargets?: MealPlanTargets | null;
  onRefreshFoodBank?: () => void;
};

function todayKey(): string {
  return toIsoDateKey(new Date());
}

function entryMacros(entry: MemberQuickFoodLogEntry): string {
  const scale = entry.grams > 0 ? entry.grams / 100 : 0;
  return `${formatMacro(entry.nutritionPer100g.kcal * scale, 0)} kcal · P ${formatMacro(entry.nutritionPer100g.protein * scale, 1)} g`;
}

export function LogMealPanel({ memberId, mealPlanTargets, onRefreshFoodBank }: LogMealPanelProps) {
  const [open, setOpen] = useState(false);
  const [mealSlotId, setMealSlotId] = useState(MEMBER_MEAL_SLOTS[0]!.id);
  const [status, setStatus] = useState<string | null>(null);
  const [state, setState] = useState<MemberMealPlanState>(() => loadMemberMealPlanState(memberId));
  const stateRef = useRef(state);

  const dateKey = todayKey();
  const logsToday = state.quickFoodLogs[dateKey] ?? [];
  const hasLogs = logsToday.length > 0;

  const replaceState = useCallback((nextState: MemberMealPlanState) => {
    stateRef.current = nextState;
    setState(nextState);
  }, []);

  useEffect(() => {
    onRefreshFoodBank?.();
  }, [onRefreshFoodBank]);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      const synced = await syncMemberMealPlanState(memberId);
      if (mounted) replaceState(mergeMemberMealPlanStates(stateRef.current, synced));
    })();
    return () => {
      mounted = false;
    };
  }, [memberId, replaceState]);

  useEffect(() => {
    const handler = () => replaceState(loadMemberMealPlanState(memberId));
    window.addEventListener(MEAL_PLAN_STATE_CHANGED_EVENT, handler);
    return () => window.removeEventListener(MEAL_PLAN_STATE_CHANGED_EVENT, handler);
  }, [memberId, replaceState]);

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

  const handleLogFood = useCallback(
    (draft: FoodLogDraft) => {
      const entry: MemberQuickFoodLogEntry = {
        id: `log-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
        name: draft.food.name,
        grams: draft.grams,
        source: "food",
        mealId: mealSlotId,
        loggedAt: new Date().toISOString(),
        nutritionPer100g: { ...draft.food.nutritionPer100g },
      };
      replaceState(addQuickFoodLog(memberId, stateRef.current, dateKey, entry));
      const slotLabel = memberMealSlotLabel(mealSlotId);
      setStatus(`${draft.food.name} logget til ${slotLabel.toLowerCase()}.`);
      setOpen(hasLogs);
    },
    [dateKey, hasLogs, mealSlotId, memberId, replaceState],
  );

  const removeLog = useCallback(
    (entryId: string) => {
      replaceState(removeQuickFoodLog(memberId, stateRef.current, dateKey, entryId));
    },
    [dateKey, memberId, replaceState],
  );

  if (!open && !hasLogs) {
    return (
      <div className="motus-log-meal-hero">
        <div className="motus-log-meal-hero__icon" aria-hidden>
          <UtensilsCrossed className="h-7 w-7" />
        </div>
        <h2 className="motus-log-meal-hero__title">Logg det du spiser</h2>
        <p className="motus-log-meal-hero__lead">
          Du har ingen matplan fra treneren ennå. Start med å logge et måltid — velg frokost, lunsj, middag og mer, og søk
          opp matvarer fra matbanken.
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
      {hasLogs ? <DailyLoggedMacrosSummary macros={macrosToday} targets={mealPlanTargets} /> : null}

      {hasLogs && !open ? (
        <div className="motus-log-meal-panel__summary">
          <div className="motus-log-meal-panel__summary-head">
            <h2 className="motus-log-meal-panel__title">Logget i dag</h2>
            <GradientButton type="button" className="motus-log-meal-cta motus-log-meal-cta--compact" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" aria-hidden />
              Logg et måltid
            </GradientButton>
          </div>
          <div className="motus-log-meal-panel__groups">
            {MEMBER_MEAL_SLOTS.map((slot) => {
              const entries = logsBySlot.get(slot.id) ?? [];
              if (!entries.length) return null;
              return (
                <div key={slot.id} className="motus-log-meal-panel__group">
                  <h3 className="motus-log-meal-panel__group-title">{slot.label}</h3>
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
                </div>
              );
            })}
          </div>
        </div>
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
              </button>
            ))}
          </div>

          <p className="motus-log-meal-panel__step-label">2. Søk og logg matvarer</p>
          <FoodLogFormFields onSubmit={handleLogFood} submitLabel="Legg til" />
        </div>
      ) : null}

      {status ? <p className="motus-log-meal-panel__status">{status}</p> : null}
    </div>
  );
}
