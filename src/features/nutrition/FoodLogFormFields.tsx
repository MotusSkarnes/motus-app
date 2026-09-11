import { useEffect, useMemo, useRef, useState } from "react";
import { formatMacro, type FoodItem } from "../../app/foodBankTypes";
import { normalizeFoodBankNameKey } from "../../app/foodBankNameKey";
import {
  defaultMeasureModeForFood,
  foodMeasureOptionsForItem,
  resolveFoodLogGrams,
  type FoodMeasureMode,
} from "../../app/foodPortionMeasure";
import { defaultPortionGramsForFood } from "../../app/foodPortionDefaults";
import { useFoodBankItems } from "../../app/useFoodBankItems";
import { OutlineButton, TextInput } from "../../app/ui";

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
  const byId = foodItems.find((item) => item.id === selected.id);
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
  const [measureMode, setMeasureMode] = useState<FoodMeasureMode>("grams");
  const [quantityInput, setQuantityInput] = useState("100");
  const [error, setError] = useState<string | null>(null);
  const quantityInputRef = useRef<HTMLInputElement | null>(null);
  const lastConfiguredFoodIdRef = useRef("");
  const hasSearchQuery = search.trim().length > 0;

  const filteredFoods = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matches = (item: FoodItem) => {
      const haystack = `${item.name} ${item.origin} ${item.createdBy}`.toLowerCase();
      return !q || haystack.includes(q);
    };
    const matched = q ? foodItems.filter(matches) : foodItems;
    return matched.slice(0, 24);
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

  const measureOptions = useMemo(() => foodMeasureOptionsForItem(selectedFood), [selectedFood]);

  const activeMeasure = useMemo(
    () => measureOptions.find((option) => option.mode === measureMode) ?? measureOptions[0]!,
    [measureMode, measureOptions],
  );

  useEffect(() => {
    if (!selectedFood) {
      lastConfiguredFoodIdRef.current = "";
      return;
    }
    const configKey = `${selectedFood.id}:${selectedFood.portionGrams}:${selectedFood.portionLabel}`;
    if (lastConfiguredFoodIdRef.current === configKey) return;
    lastConfiguredFoodIdRef.current = configKey;
    const mode = defaultMeasureModeForFood(selectedFood);
    setMeasureMode(mode);
    setQuantityInput(mode === "portion" ? "1" : String(defaultPortionGramsForFood(selectedFood)));
  }, [selectedFood]);

  const previewGrams = useMemo(() => {
    if (!selectedFood) return 0;
    const quantity = Number(quantityInput.replace(",", "."));
    return resolveFoodLogGrams(selectedFood, activeMeasure.mode, quantity, activeMeasure.gramsPerUnit);
  }, [activeMeasure, quantityInput, selectedFood]);

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
    setMeasureMode("grams");
  }

  function handleSubmit() {
    if (!selectedFood) {
      setError("Velg en matvare.");
      return;
    }
    const quantity = Number(quantityInput.replace(",", "."));
    const grams = resolveFoodLogGrams(selectedFood, activeMeasure.mode, quantity, activeMeasure.gramsPerUnit);
    if (!Number.isFinite(grams) || grams <= 0) {
      setError(activeMeasure.mode === "portion" ? "Skriv inn gyldig antall." : "Skriv inn gyldig gram.");
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
          <div className="motus-food-log-form__measure-row">
            {measureOptions.map((option) => (
              <button
                key={option.mode}
                type="button"
                className={`motus-food-log-form__measure-chip ${measureMode === option.mode ? "motus-food-log-form__measure-chip--active" : ""}`}
                onClick={() => {
                  setMeasureMode(option.mode);
                  setQuantityInput(option.mode === "portion" ? "1" : String(defaultPortionGramsForFood(selectedFood)));
                }}
              >
                {option.mode === "grams" ? "Gram" : option.label}
              </button>
            ))}
          </div>
          <div className="motus-food-log-form__row">
            <label className="motus-food-log-form__qty">
              <span className="motus-food-log-form__qty-label">
                {measureMode === "portion" ? `Antall (${activeMeasure.label})` : "Gram"}
              </span>
              <TextInput
                ref={quantityInputRef}
                value={quantityInput}
                onChange={(e) => setQuantityInput(e.target.value)}
                inputMode="decimal"
                className="motus-food-log-form__qty-input"
              />
            </label>
            <OutlineButton type="button" onClick={handleSubmit}>
              {submitLabel}
            </OutlineButton>
          </div>
          {previewGrams > 0 ? (
            <p className="motus-food-log-form__preview">
              {selectedFood.name} · {formatMacro(previewGrams, 0)} g
            </p>
          ) : null}
        </>
      ) : null}
      {error ? <p className="motus-food-log-form__error">{error}</p> : null}
    </div>
  );
}
