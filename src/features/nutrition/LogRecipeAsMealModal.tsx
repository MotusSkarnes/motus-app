import { useCallback, useEffect, useId, useState } from "react";
import { X } from "lucide-react";
import { draftToQuickLogEntry, type MealDraftItem } from "../../app/mealDraft";
import {
  loadMemberMealPlanState,
  toIsoDateKey,
  type MemberMealPlanState,
} from "../../app/memberMealPlanState";
import { addMemberSavedMeal, addQuickFoodLogs, removeMemberSavedMeal } from "../../app/memberMealPlanTracking";
import { MEMBER_MEAL_SLOTS, memberMealSlotLabel } from "../../app/memberMealSlots";
import { resolveNutritionFromFoodItems } from "../../app/memberNutritionRehydrate";
import type { MemberSavedMeal } from "../../app/memberSavedMeals";
import { useFoodBankItems } from "../../app/useFoodBankItems";
import type { FoodItem } from "../../app/foodBankTypes";
import { MealDraftComposer } from "./MealDraftComposer";
import "../../foodbank.css";

type LogRecipeAsMealModalProps = {
  open: boolean;
  memberId: string;
  recipeTitle: string;
  initialDraftItems: MealDraftItem[];
  defaultMealSlotId?: string;
  dateKey?: string;
  foodItems?: FoodItem[];
  onClose: () => void;
  onLogged?: (info: { mealSlotId: string; itemCount: number; dateKey: string }) => void;
};

function todayKey(): string {
  return toIsoDateKey(new Date());
}

export function LogRecipeAsMealModal({
  open,
  memberId,
  recipeTitle,
  initialDraftItems,
  defaultMealSlotId,
  dateKey: dateKeyProp,
  foodItems: foodItemsProp,
  onClose,
  onLogged,
}: LogRecipeAsMealModalProps) {
  const titleId = useId();
  const bankFoodItems = useFoodBankItems();
  const foodItems = foodItemsProp?.length ? foodItemsProp : bankFoodItems;
  const dateKey = dateKeyProp?.trim() || todayKey();
  const [mealSlotId, setMealSlotId] = useState(
    defaultMealSlotId && MEMBER_MEAL_SLOTS.some((slot) => slot.id === defaultMealSlotId)
      ? defaultMealSlotId
      : MEMBER_MEAL_SLOTS[0]!.id,
  );
  const [draftItems, setDraftItems] = useState<MealDraftItem[]>(initialDraftItems);
  const [state, setState] = useState<MemberMealPlanState>(() => loadMemberMealPlanState(memberId));
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setMealSlotId(
      defaultMealSlotId && MEMBER_MEAL_SLOTS.some((slot) => slot.id === defaultMealSlotId)
        ? defaultMealSlotId
        : MEMBER_MEAL_SLOTS[0]!.id,
    );
    setDraftItems(initialDraftItems);
    setState(loadMemberMealPlanState(memberId));
    setStatus(null);
  }, [defaultMealSlotId, initialDraftItems, memberId, open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

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

  const handleCommitLog = useCallback(() => {
    if (!draftItems.length) return;
    const entries = draftItems.map((item) => {
      const nutritionPer100g = resolveNutritionFromFoodItems(item.name, item.nutritionPer100g, foodItems, item.foodId);
      return draftToQuickLogEntry({ ...item, nutritionPer100g }, mealSlotId);
    });
    addQuickFoodLogs(memberId, state, dateKey, entries);
    onLogged?.({ mealSlotId, itemCount: draftItems.length, dateKey });
    onClose();
  }, [dateKey, draftItems, foodItems, mealSlotId, memberId, onClose, onLogged, state]);

  if (!open) return null;

  return (
    <div className="motus-foodbank-modal-backdrop motus-modal-insets" role="presentation" onClick={onClose}>
      <div
        className="motus-foodbank-modal motus-foodbank-modal--wide motus-log-recipe-meal-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="motus-foodbank-modal-head">
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-bold text-slate-900">
              Logg som måltid
            </h2>
            <p className="mt-0.5 text-sm text-slate-600">
              {recipeTitle} er lagt inn. Endre gjerne mengder ved å fjerne eller legge til, og velg måltid.
            </p>
          </div>
          <button type="button" className="motus-foodbank-icon-btn" onClick={onClose} aria-label="Lukk">
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <div className="motus-foodbank-modal-body motus-log-recipe-meal-modal__body">
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
          {draftItems.length === 0 ? (
            <p className="rounded-xl border border-amber-100 bg-amber-50/80 px-3 py-2 text-xs text-amber-900">
              Fant ingen matvarer i måltidet. Søk og legg til selv under.
            </p>
          ) : null}
          <MealDraftComposer
            mealSlotId={mealSlotId}
            mealSlotLabel={memberMealSlotLabel(mealSlotId)}
            draftItems={draftItems}
            onDraftChange={setDraftItems}
            savedMeals={state.savedMeals ?? []}
            onSaveTemplate={handleSaveTemplate}
            onDeleteSaved={handleDeleteSaved}
            onCommitLog={handleCommitLog}
            foodItems={foodItems}
          />
          {status ? <p className="motus-log-meal-panel__status">{status}</p> : null}
        </div>
      </div>
    </div>
  );
}
