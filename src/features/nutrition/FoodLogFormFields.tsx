import { useEffect, useMemo, useRef, useState } from "react";
import { formatMacro, type FoodItem } from "../../app/foodBankTypes";
import { normalizeFoodBankNameKey } from "../../app/foodBankNameKey";
import {
  defaultFoodLogQuantityForUnit,
  defaultFoodLogUnitForItem,
  foodLogUnitOptionsForItem,
  resolveFoodLogGramsForUnit,
} from "../../app/foodPortionMeasure";
import { defaultPortionGramsForFood } from "../../app/foodPortionDefaults";
import { findFoodItemById } from "../../app/foodBankDedup";
import { searchFoodBankItems } from "../../app/foodBankSearch";
import { formatGramsAmount } from "../../app/foodUnitGrams";
import { useFoodBankItems } from "../../app/useFoodBankItems";
import { OutlineButton, SelectBox, TextInput } from "../../app/ui";

export type FoodLogDraft = {
  food: FoodItem;
  grams: number;
};

type FoodLogFormFieldsProps = {
  onSubmit: (draft: FoodLogDraft) => void;
  submitLabel?: string;
  compact?: boolean;
};

/** Prefer live bank row by id, then name key, else keep sticky snapshot. */
export function resolveSelectedFoodFromBank(
  foodItems: FoodItem[],
  selected: FoodItem | null,
): FoodItem | null {
  if (!selected) return null;
  const byId = findFoodItemById(foodItems, selected.id);
  if (byId) return byId;
  const nameKey = normalizeFoodBankNameKey(selected.name);
  if (!nameKey) return selected;
  const byName = foodItems.find(
    (item) =>
      item.category === selected.category && normalizeFoodBankNameKey(item.name) === nameKey,
  );
  return byName ?? selected;
}

export function FoodLogFormFields({ onSubmit, submitLabel = "Logg", compact = false }: FoodLogFormFieldsProps) {
  const foodItems = useFoodBankItems();
  const [search, setSearch] = useState("");
  const [selectedFood, setSelectedFood] = useState<FoodItem | null>(null);
  const [unit, setUnit] = useState("g");
  const [quantityInput, setQuantityInput] = useState("100");
  const [error, setError] = useState<string | null>(null);
  const quantityInputRef = useRef<HTMLInputElement | null>(null);
  const lastConfiguredFoodIdRef = useRef("");
  const hasSearchQuery = search.trim().length > 0;

  const filteredFoods = useMemo(() => {
    const q = search.trim();
    if (!q) return foodItems.slice(0, 24);
    return searchFoodBankItems(foodItems, q, 24);
  }, [foodItems, search]);

  // Keep selection sticky across food-bank sync/dedupe (id may change for duplicates).
  useEffect(() => {
    setSelectedFood((prev) => {
      const next = resolveSelectedFoodFromBank(foodItems, prev);
      if (prev && next && prev.id !== next.id) {
        // Same food, remapped id — don't treat as a new selection (preserve quantity).
        lastConfiguredFoodIdRef.current = `${next.id}:${next.portionGrams}:${next.portionLabel}`;
      }
      return next;
    });
  }, [foodItems]);

  const unitOptions = useMemo(() => foodLogUnitOptionsForItem(selectedFood), [selectedFood]);
  const activeUnit = useMemo(
    () => unitOptions.find((option) => option.unit === unit) ?? unitOptions[0]!,
    [unit, unitOptions],
  );

  useEffect(() => {
    if (!selectedFood) {
      lastConfiguredFoodIdRef.current = "";
      return;
    }
    const configKey = `${selectedFood.id}:${selectedFood.portionGrams}:${selectedFood.portionLabel}`;
    if (lastConfiguredFoodIdRef.current === configKey) return;
    lastConfiguredFoodIdRef.current = configKey;
    const nextUnit = defaultFoodLogUnitForItem(selectedFood);
    setUnit(nextUnit);
    setQuantityInput(defaultFoodLogQuantityForUnit(selectedFood, nextUnit));
  }, [selectedFood]);

  const previewGrams = useMemo(() => {
    if (!selectedFood) return 0;
    const quantity = Number(quantityInput.replace(",", "."));
    return resolveFoodLogGramsForUnit(quantity, activeUnit.gramsPerUnit);
  }, [activeUnit, quantityInput, selectedFood]);

  function selectFood(item: FoodItem) {
    lastConfiguredFoodIdRef.current = "";
    setSelectedFood(item);
    setSearch("");
    setError(null);
    requestAnimationFrame(() => quantityInputRef.current?.focus());
  }

  function clearSelectedFood() {
    setSelectedFood(null);
    lastConfiguredFoodIdRef.current = "";
    setQuantityInput("100");
    setUnit("g");
  }

  function handleSubmit() {
    if (!selectedFood) {
      setError("Velg en matvare.");
      return;
    }
    const quantity = Number(quantityInput.replace(",", "."));
    const grams = resolveFoodLogGramsForUnit(quantity, activeUnit.gramsPerUnit);
    if (!Number.isFinite(grams) || grams <= 0) {
      setError(activeUnit.unit === "g" ? "Skriv inn gyldig gram." : "Skriv inn gyldig mengde.");
      return;
    }
    setError(null);
    onSubmit({ food: selectedFood, grams });
    setSearch("");
    clearSelectedFood();
  }

  return (
    <div className={`motus-food-log-form ${compact ? "motus-food-log-form--compact" : ""}`}>
      {selectedFood ? (
        <div className="motus-food-log-form__selected">
          <div className="motus-food-log-form__selected-main">
            <span className="motus-food-log-form__selected-name">{selectedFood.name}</span>
            <span className="motus-food-log-form__selected-meta">
              {formatMacro(selectedFood.nutritionPer100g.kcal, 0)} kcal / 100 g
            </span>
          </div>
          <button type="button" className="motus-food-log-form__selected-clear" onClick={clearSelectedFood}>
            Bytt
          </button>
        </div>
      ) : (
        <>
          <TextInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Søk matvare…"
            className="motus-food-log-form__search"
          />
          {hasSearchQuery ? (
            <div className="motus-food-log-form__food-list" role="listbox" aria-label="Matvarer">
              {filteredFoods.length === 0 ? (
                <p className="motus-food-log-form__empty">Ingen matvarer matcher søket.</p>
              ) : (
                filteredFoods.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    role="option"
                    aria-selected={false}
                    className="motus-food-log-form__food-option"
                    onClick={() => selectFood(item)}
                  >
                    <span className="motus-food-log-form__food-name">{item.name}</span>
                    <span className="motus-food-log-form__food-meta">{defaultPortionGramsForFood(item)} g / 100g</span>
                  </button>
                ))
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-500">Skriv i søkefeltet for å se varer.</p>
          )}
        </>
      )}
      {selectedFood ? (
        <>
          <div className="motus-food-log-form__row">
            <label className="motus-food-log-form__qty">
              <span className="motus-food-log-form__qty-label">Mengde</span>
              <TextInput
                ref={quantityInputRef}
                value={quantityInput}
                onChange={(e) => setQuantityInput(e.target.value)}
                inputMode="decimal"
                className="motus-food-log-form__qty-input"
                aria-label="Mengde"
              />
            </label>
            <label className="motus-food-log-form__unit">
              <span className="motus-food-log-form__qty-label">Enhet</span>
              <SelectBox
                value={activeUnit.unit}
                onChange={(nextUnit) => {
                  setUnit(nextUnit);
                  setQuantityInput(defaultFoodLogQuantityForUnit(selectedFood, nextUnit));
                }}
                options={unitOptions.map((option) => ({ value: option.unit, label: option.label }))}
                className="motus-food-log-form__unit-select"
              />
            </label>
            <OutlineButton type="button" onClick={handleSubmit}>
              {submitLabel}
            </OutlineButton>
          </div>
          {previewGrams > 0 ? (
            <p className="motus-food-log-form__preview">
              {quantityInput.trim() || "0"} {activeUnit.label} · {formatGramsAmount(previewGrams)} · {selectedFood.name}
            </p>
          ) : null}
        </>
      ) : null}
      {error ? <p className="motus-food-log-form__error">{error}</p> : null}
    </div>
  );
}
