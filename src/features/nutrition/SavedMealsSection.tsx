import { useMemo, useState } from "react";
import { Bookmark, BookmarkPlus, Trash2 } from "lucide-react";
import { formatMacro } from "../../app/foodBankTypes";
import { memberMealSlotLabel } from "../../app/memberMealSlots";
import type { MemberQuickFoodLogEntry } from "../../app/memberMealPlanState";
import {
  createSavedMealFromQuickLogs,
  defaultSavedMealName,
  savedMealsForSlot,
  type MemberSavedMeal,
} from "../../app/memberSavedMeals";
import { sumQuickFoodLogMacros } from "../../app/quickFoodLogMacros";
import { OutlineButton, TextInput } from "../../app/ui";

type SavedMealsSectionProps = {
  mealSlotId: string;
  mealSlotLabel?: string;
  savedMeals: MemberSavedMeal[];
  currentSlotLogs?: MemberQuickFoodLogEntry[];
  onApply: (meal: MemberSavedMeal) => void;
  onSave: (meal: MemberSavedMeal) => void;
  onDelete: (savedMealId: string) => void;
  compact?: boolean;
};

function savedMealMacros(meal: MemberSavedMeal) {
  const pseudoLogs = meal.items.map((item, index) => ({
    id: `preview-${index}`,
    name: item.name,
    grams: item.grams,
    source: item.source,
    loggedAt: "",
    nutritionPer100g: item.nutritionPer100g,
  }));
  return sumQuickFoodLogMacros(pseudoLogs);
}

export function SavedMealsSection({
  mealSlotId,
  mealSlotLabel,
  savedMeals,
  currentSlotLogs = [],
  onApply,
  onSave,
  onDelete,
  compact = false,
}: SavedMealsSectionProps) {
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const slotLabel = mealSlotLabel ?? memberMealSlotLabel(mealSlotId);
  const slotMeals = useMemo(() => savedMealsForSlot(savedMeals, mealSlotId), [mealSlotId, savedMeals]);
  const canSaveCurrent = currentSlotLogs.length > 0;

  if (!slotMeals.length && !canSaveCurrent) return null;

  function openSave() {
    setSaveName(defaultSavedMealName(currentSlotLogs, slotLabel));
    setSaveOpen(true);
  }

  function handleSave() {
    const name = saveName.trim();
    if (!name || !currentSlotLogs.length) return;
    onSave(createSavedMealFromQuickLogs(currentSlotLogs, name, mealSlotId));
    setSaveOpen(false);
    setSaveName("");
  }

  return (
    <section
      className={`motus-saved-meals ${compact ? "motus-saved-meals--compact" : ""}`}
      aria-label="Lagrede måltider"
    >
      <div className="motus-saved-meals__head">
        <h3 className="motus-saved-meals__title">
          <Bookmark className="h-4 w-4" aria-hidden />
          Lagrede måltider
        </h3>
        {canSaveCurrent && !saveOpen ? (
          <button type="button" className="motus-saved-meals__save-trigger motus-pressable" onClick={openSave}>
            <BookmarkPlus className="h-3.5 w-3.5" aria-hidden />
            Lagre dette måltidet
          </button>
        ) : null}
      </div>

      {saveOpen ? (
        <div className="motus-saved-meals__save-form">
          <label className="motus-saved-meals__save-label" htmlFor={`saved-meal-name-${mealSlotId}`}>
            Navn på måltidet
          </label>
          <TextInput
            id={`saved-meal-name-${mealSlotId}`}
            value={saveName}
            onChange={(event) => setSaveName(event.target.value)}
            placeholder="F.eks. Min frokost"
          />
          <div className="motus-saved-meals__save-actions">
            <OutlineButton type="button" onClick={() => setSaveOpen(false)}>
              Avbryt
            </OutlineButton>
            <OutlineButton type="button" onClick={handleSave} disabled={!saveName.trim()}>
              Lagre
            </OutlineButton>
          </div>
          <p className="motus-saved-meals__save-hint">
            {currentSlotLogs.length} {currentSlotLogs.length === 1 ? "matvare" : "matvarer"} lagres for senere.
          </p>
        </div>
      ) : null}

      {slotMeals.length > 0 ? (
        <ul className="motus-saved-meals__list">
          {slotMeals.map((meal) => {
            const macros = savedMealMacros(meal);
            return (
              <li key={meal.id} className="motus-saved-meals__item">
                <div className="motus-saved-meals__item-main min-w-0">
                  <p className="motus-saved-meals__item-name">{meal.name}</p>
                  <p className="motus-saved-meals__item-meta">
                    {meal.items.length} {meal.items.length === 1 ? "vare" : "varer"} · {formatMacro(macros.kcal, 0)} kcal
                  </p>
                </div>
                <div className="motus-saved-meals__item-actions">
                  <button type="button" className="motus-saved-meals__use motus-pressable" onClick={() => onApply(meal)}>
                    Bruk
                  </button>
                  <button
                    type="button"
                    className="motus-saved-meals__delete motus-pressable"
                    onClick={() => onDelete(meal.id)}
                    aria-label={`Slett ${meal.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="motus-saved-meals__empty">Ingen lagrede måltider for {slotLabel.toLowerCase()} ennå.</p>
      )}
    </section>
  );
}
