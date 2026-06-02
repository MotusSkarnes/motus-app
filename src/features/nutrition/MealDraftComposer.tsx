import { useMemo, useState } from "react";
import { Bookmark, BookmarkPlus, Trash2 } from "lucide-react";
import { formatMacro } from "../../app/foodBankTypes";
import { memberMealSlotLabel } from "../../app/memberMealSlots";
import {
  createMealDraftItem,
  createSavedMealFromDraft,
  defaultDraftMealName,
  draftItemsToPseudoLogs,
  mealDraftItemsFromSavedMeal,
  type MealDraftItem,
} from "../../app/mealDraft";
import type { FoodNutrition } from "../../app/foodBankTypes";
import { resolveNutritionFromFoodItems } from "../../app/memberNutritionRehydrate";
import type { FoodItem } from "../../app/foodBankTypes";
import { savedMealsForSlot, type MemberSavedMeal } from "../../app/memberSavedMeals";
import { sumQuickFoodLogMacros } from "../../app/quickFoodLogMacros";
import { GradientButton, OutlineButton, TextInput } from "../../app/ui";
import { FoodLogFormFields, type FoodLogDraft } from "./FoodLogFormFields";

type MealDraftComposerProps = {
  mealSlotId: string;
  mealSlotLabel?: string;
  draftItems: MealDraftItem[];
  onDraftChange: (items: MealDraftItem[]) => void;
  savedMeals: MemberSavedMeal[];
  onSaveTemplate: (meal: MemberSavedMeal) => void;
  onDeleteSaved: (savedMealId: string) => void;
  onCommitLog: () => void;
  foodItems?: FoodItem[];
  compact?: boolean;
};

function entryMacrosLine(item: MealDraftItem): string {
  const scale = item.grams > 0 ? item.grams / 100 : 0;
  return `${formatMacro(item.nutritionPer100g.kcal * scale, 0)} kcal · P ${formatMacro(item.nutritionPer100g.protein * scale, 1)} g`;
}

export function MealDraftComposer({
  mealSlotId,
  mealSlotLabel,
  draftItems,
  onDraftChange,
  savedMeals,
  onSaveTemplate,
  onDeleteSaved,
  onCommitLog,
  foodItems = [],
  compact = false,
}: MealDraftComposerProps) {
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const slotLabel = mealSlotLabel ?? memberMealSlotLabel(mealSlotId);
  const slotSavedMeals = useMemo(() => savedMealsForSlot(savedMeals, mealSlotId), [mealSlotId, savedMeals]);
  const draftMacros = useMemo(() => sumQuickFoodLogMacros(draftItemsToPseudoLogs(draftItems)), [draftItems]);

  function addToDraft(draft: FoodLogDraft) {
    onDraftChange([...draftItems, createMealDraftItem(draft.food, draft.grams)]);
  }

  function removeFromDraft(itemId: string) {
    onDraftChange(draftItems.filter((item) => item.id !== itemId));
  }

  function loadSavedToDraft(meal: MemberSavedMeal) {
    const refreshed = mealDraftItemsFromSavedMeal(meal).map((item) => ({
      ...item,
      nutritionPer100g: resolveNutritionFromFoodItems(item.name, item.nutritionPer100g, foodItems, item.foodId),
    }));
    onDraftChange(refreshed);
  }

  function openSave() {
    setSaveName(defaultDraftMealName(draftItems, slotLabel));
    setSaveOpen(true);
  }

  function handleSaveTemplate() {
    const name = saveName.trim();
    if (!name || !draftItems.length) return;
    onSaveTemplate(createSavedMealFromDraft(draftItems, name, mealSlotId));
    setSaveOpen(false);
    setSaveName("");
  }

  return (
    <div className={`motus-meal-draft ${compact ? "motus-meal-draft--compact" : ""}`}>
      {slotSavedMeals.length > 0 ? (
        <section className="motus-saved-meals motus-saved-meals--inline" aria-label="Lagrede måltider">
          <h3 className="motus-saved-meals__title">
            <Bookmark className="h-4 w-4" aria-hidden />
            Lagrede måltider
          </h3>
          <ul className="motus-saved-meals__list">
            {slotSavedMeals.map((meal) => {
              const macros = sumQuickFoodLogMacros(
                meal.items.map((item, index) => ({
                  id: `preview-${index}`,
                  name: item.name,
                  grams: item.grams,
                  source: item.source,
                  loggedAt: "",
                  nutritionPer100g: item.nutritionPer100g,
                })),
              );
              return (
                <li key={meal.id} className="motus-saved-meals__item">
                  <div className="motus-saved-meals__item-main min-w-0">
                    <p className="motus-saved-meals__item-name">{meal.name}</p>
                    <p className="motus-saved-meals__item-meta">
                      {meal.items.length} {meal.items.length === 1 ? "vare" : "varer"} · {formatMacro(macros.kcal, 0)} kcal
                    </p>
                  </div>
                  <div className="motus-saved-meals__item-actions">
                    <button type="button" className="motus-saved-meals__use motus-pressable" onClick={() => loadSavedToDraft(meal)}>
                      Hent inn
                    </button>
                    <button
                      type="button"
                      className="motus-saved-meals__delete motus-pressable"
                      onClick={() => onDeleteSaved(meal.id)}
                      aria-label={`Slett ${meal.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section className="motus-meal-draft__basket" aria-label="Måltid du bygger nå">
        <header className="motus-meal-draft__basket-head">
          <h3 className="motus-meal-draft__basket-title">Dette måltidet nå</h3>
          {draftItems.length > 0 ? (
            <span className="motus-meal-draft__basket-sum">
              {draftItems.length} {draftItems.length === 1 ? "vare" : "varer"} · {formatMacro(draftMacros.kcal, 0)} kcal
            </span>
          ) : (
            <span className="motus-meal-draft__basket-empty-hint">Legg til matvarer under — de vises her før du logger.</span>
          )}
        </header>

        {draftItems.length > 0 ? (
          <>
            <ul className="motus-meal-draft__list">
              {draftItems.map((item) => (
                <li key={item.id} className="motus-meal-draft__item">
                  <div className="min-w-0">
                    <p className="motus-meal-draft__item-name">
                      {item.name} · {formatMacro(item.grams, 0)} g
                    </p>
                    <p className="motus-meal-draft__item-meta">{entryMacrosLine(item)}</p>
                  </div>
                  <button
                    type="button"
                    className="motus-meal-draft__remove motus-pressable"
                    onClick={() => removeFromDraft(item.id)}
                    aria-label={`Fjern ${item.name} fra måltidet`}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
            <div className="motus-meal-draft__actions">
              <GradientButton type="button" className="motus-meal-draft__log-btn" onClick={onCommitLog}>
                Logg måltid
              </GradientButton>
              {!saveOpen ? (
                <button type="button" className="motus-meal-draft__save-trigger motus-pressable" onClick={openSave}>
                  <BookmarkPlus className="h-3.5 w-3.5" aria-hidden />
                  Lagre til senere
                </button>
              ) : null}
            </div>
            {saveOpen ? (
              <div className="motus-saved-meals__save-form">
                <label className="motus-saved-meals__save-label" htmlFor={`draft-save-name-${mealSlotId}`}>
                  Navn på måltidet
                </label>
                <TextInput
                  id={`draft-save-name-${mealSlotId}`}
                  value={saveName}
                  onChange={(event) => setSaveName(event.target.value)}
                  placeholder="F.eks. Min frokost"
                />
                <div className="motus-saved-meals__save-actions">
                  <OutlineButton type="button" onClick={() => setSaveOpen(false)}>
                    Avbryt
                  </OutlineButton>
                  <OutlineButton type="button" onClick={handleSaveTemplate} disabled={!saveName.trim()}>
                    Lagre
                  </OutlineButton>
                </div>
                <p className="motus-saved-meals__save-hint">
                  Lagrer {draftItems.length} {draftItems.length === 1 ? "matvare" : "matvarer"} — ikke det som allerede er logget i dag.
                </p>
              </div>
            ) : null}
          </>
        ) : null}
      </section>

      <p className="motus-meal-draft__search-label">Søk og legg til matvare</p>
      <FoodLogFormFields onSubmit={addToDraft} submitLabel="Legg til i måltid" compact={compact} />
    </div>
  );
}
