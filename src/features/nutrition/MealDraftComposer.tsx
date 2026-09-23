import { useEffect, useMemo, useState } from "react";
import { BookmarkPlus, Trash2 } from "lucide-react";
import { formatMacro } from "../../app/foodBankTypes";
import { canonicalMemberMealSlotId, memberMealSlotLabel } from "../../app/memberMealSlots";
import {
  createMealDraftItem,
  createSavedMealFromDraft,
  defaultDraftMealName,
  draftItemsToPseudoLogs,
  mealDraftItemsFromSavedMeal,
  updateSavedMealFromDraft,
  type MealDraftItem,
} from "../../app/mealDraft";
import { resolveNutritionFromFoodItems } from "../../app/memberNutritionRehydrate";
import type { FoodItem } from "../../app/foodBankTypes";
import { savedMealsForSlot, type MemberSavedMeal } from "../../app/memberSavedMeals";
import { sumQuickFoodLogMacros } from "../../app/quickFoodLogMacros";
import { GradientButton, OutlineButton, TextInput } from "../../app/ui";
import { FoodLogFormFields, type FoodLogDraft } from "./FoodLogFormFields";
import { SavedMealsPicker } from "./SavedMealsPicker";

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

function DraftItemRow({
  item,
  onGramsChange,
  onRemove,
}: {
  item: MealDraftItem;
  onGramsChange: (grams: number) => void;
  onRemove: () => void;
}) {
  const [gramsInput, setGramsInput] = useState(String(item.grams));

  useEffect(() => setGramsInput(String(item.grams)), [item.grams]);

  function commitGrams() {
    const grams = Number(gramsInput.replace(",", "."));
    if (Number.isFinite(grams) && grams > 0 && grams <= 5000) {
      onGramsChange(Math.round(grams * 10) / 10);
      return;
    }
    setGramsInput(String(item.grams));
  }

  return (
    <li className="motus-meal-draft__item">
      <div className="min-w-0 flex-1">
        <p className="motus-meal-draft__item-name">{item.name}</p>
        <p className="motus-meal-draft__item-meta">{entryMacrosLine(item)}</p>
      </div>
      <label className="motus-meal-draft__amount">
        <span className="sr-only">Mengde for {item.name}</span>
        <input
          type="number"
          inputMode="decimal"
          min={1}
          max={5000}
          step={1}
          value={gramsInput}
          onChange={(event) => setGramsInput(event.target.value)}
          onBlur={commitGrams}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
          aria-label={`Mengde for ${item.name}`}
        />
        <span>g</span>
      </label>
      <button
        type="button"
        className="motus-meal-draft__remove motus-pressable"
        onClick={onRemove}
        aria-label={`Fjern ${item.name} fra måltidet`}
      >
        <Trash2 className="h-4 w-4" aria-hidden />
      </button>
    </li>
  );
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
  const [editingSaved, setEditingSaved] = useState<{ meal: MemberSavedMeal; previousDraft: MealDraftItem[] } | null>(null);
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
    setEditingSaved(null);
    onDraftChange(refreshed);
  }

  function editSavedMeal(meal: MemberSavedMeal) {
    const refreshed = mealDraftItemsFromSavedMeal(meal).map((item) => ({
      ...item,
      nutritionPer100g: resolveNutritionFromFoodItems(item.name, item.nutritionPer100g, foodItems, item.foodId),
    }));
    setEditingSaved({ meal, previousDraft: draftItems });
    setSaveOpen(false);
    setSaveName(meal.name);
    onDraftChange(refreshed);
  }

  function cancelSavedMealEdit() {
    if (!editingSaved) return;
    onDraftChange(editingSaved.previousDraft);
    setEditingSaved(null);
    setSaveName("");
  }

  function handleUpdateSavedMeal() {
    const name = saveName.trim();
    if (!editingSaved || !name || !draftItems.length) return;
    onSaveTemplate(
      updateSavedMealFromDraft(
        editingSaved.meal,
        draftItems,
        name,
        canonicalMemberMealSlotId(mealSlotId, slotLabel) ?? mealSlotId,
      ),
    );
    setEditingSaved(null);
    setSaveName("");
  }

  function openSave() {
    setSaveName(defaultDraftMealName(draftItems, slotLabel));
    setSaveOpen(true);
  }

  function handleSaveTemplate() {
    const name = saveName.trim();
    if (!name || !draftItems.length) return;
    onSaveTemplate(
      createSavedMealFromDraft(draftItems, name, canonicalMemberMealSlotId(mealSlotId, slotLabel) ?? mealSlotId),
    );
    setSaveOpen(false);
    setSaveName("");
  }

  return (
    <div className={`motus-meal-draft ${compact ? "motus-meal-draft--compact" : ""}`}>
      <section className="motus-meal-draft__search-block" aria-label="Søk matvare">
        <p className="motus-meal-draft__search-label">Søk og legg til matvare</p>
        <FoodLogFormFields onSubmit={addToDraft} submitLabel="Legg til i måltid" compact={compact} />
      </section>

      <hr className="motus-meal-draft__section-divider" />

      <section className="motus-meal-draft__basket" aria-label="Måltid du bygger nå">
        <header className="motus-meal-draft__basket-head">
          <h3 className="motus-meal-draft__basket-title">Dette er måltidet nå</h3>
          {draftItems.length > 0 ? (
            <span className="motus-meal-draft__basket-sum">
              {draftItems.length} {draftItems.length === 1 ? "vare" : "varer"} · {formatMacro(draftMacros.kcal, 0)} kcal
            </span>
          ) : (
            <span className="motus-meal-draft__basket-empty-hint">Legg til matvarer over — de vises her før du logger.</span>
          )}
        </header>

        {draftItems.length > 0 ? (
          <>
            <ul className="motus-meal-draft__list">
              {draftItems.map((item) => (
                <DraftItemRow
                  key={item.id}
                  item={item}
                  onGramsChange={(grams) =>
                    onDraftChange(draftItems.map((row) => (row.id === item.id ? { ...row, grams } : row)))
                  }
                  onRemove={() => removeFromDraft(item.id)}
                />
              ))}
            </ul>
            {editingSaved ? (
              <div className="motus-saved-meals__edit-form">
                <p className="motus-saved-meals__edit-title">Redigerer «{editingSaved.meal.name}»</p>
                <label className="motus-saved-meals__save-label" htmlFor={`draft-edit-name-${mealSlotId}`}>
                  Navn på måltidet
                </label>
                <TextInput
                  id={`draft-edit-name-${mealSlotId}`}
                  value={saveName}
                  onChange={(event) => setSaveName(event.target.value)}
                />
                <div className="motus-saved-meals__save-actions">
                  <OutlineButton type="button" onClick={cancelSavedMealEdit}>Avbryt</OutlineButton>
                  <OutlineButton
                    type="button"
                    onClick={handleUpdateSavedMeal}
                    disabled={!saveName.trim() || !draftItems.length}
                  >
                    Lagre endringer
                  </OutlineButton>
                </div>
                <p className="motus-saved-meals__save-hint">Du kan endre mengder, fjerne varer eller søke inn flere varer over.</p>
              </div>
            ) : null}
            <div className="motus-meal-draft__actions">
              <GradientButton type="button" className="motus-meal-draft__log-btn" onClick={onCommitLog}>
                Logg måltid
              </GradientButton>
              {!saveOpen && !editingSaved ? (
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

      {slotSavedMeals.length > 0 ? (
        <>
          <hr className="motus-meal-draft__section-divider" />
          <SavedMealsPicker
            meals={slotSavedMeals}
            slotLabel={slotLabel}
            onSelect={loadSavedToDraft}
            onEdit={editSavedMeal}
            onDelete={(savedMealId) => {
              if (editingSaved?.meal.id === savedMealId) setEditingSaved(null);
              onDeleteSaved(savedMealId);
            }}
          />
        </>
      ) : null}
    </div>
  );
}
