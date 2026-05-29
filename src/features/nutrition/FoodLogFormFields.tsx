import { useEffect, useMemo, useState } from "react";
import { formatMacro, type FoodItem } from "../../app/foodBankTypes";
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

export function FoodLogFormFields({ onSubmit, submitLabel = "Logg", compact = false }: FoodLogFormFieldsProps) {
  const foodItems = useFoodBankItems();
  const [search, setSearch] = useState("");
  const [selectedFoodId, setSelectedFoodId] = useState("");
  const [measureMode, setMeasureMode] = useState<FoodMeasureMode>("grams");
  const [quantityInput, setQuantityInput] = useState("100");
  const [error, setError] = useState<string | null>(null);

  const filteredFoods = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matches = (item: FoodItem) => {
      const haystack = `${item.name} ${item.origin} ${item.createdBy}`.toLowerCase();
      return !q || haystack.includes(q);
    };
    const matched = q ? foodItems.filter(matches) : foodItems;
    return matched.slice(0, 24);
  }, [foodItems, search]);

  const selectedFood = useMemo(
    () => foodItems.find((item) => item.id === selectedFoodId) ?? null,
    [foodItems, selectedFoodId],
  );

  const measureOptions = useMemo(() => foodMeasureOptionsForItem(selectedFood), [selectedFood]);

  const activeMeasure = useMemo(
    () => measureOptions.find((option) => option.mode === measureMode) ?? measureOptions[0]!,
    [measureMode, measureOptions],
  );

  useEffect(() => {
    if (!selectedFood) return;
    const mode = defaultMeasureModeForFood(selectedFood);
    setMeasureMode(mode);
    setQuantityInput(mode === "portion" ? "1" : String(defaultPortionGramsForFood(selectedFood)));
  }, [selectedFood]);

  const previewGrams = useMemo(() => {
    if (!selectedFood) return 0;
    const quantity = Number(quantityInput.replace(",", "."));
    return resolveFoodLogGrams(selectedFood, activeMeasure.mode, quantity, activeMeasure.gramsPerUnit);
  }, [activeMeasure, quantityInput, selectedFood]);

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
    setSelectedFoodId("");
    setQuantityInput("100");
    setMeasureMode("grams");
  }

  return (
    <div className={`motus-food-log-form ${compact ? "motus-food-log-form--compact" : ""}`}>
      <TextInput
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Søk matvare…"
        className="motus-food-log-form__search"
      />
      <div className="motus-food-log-form__food-list" role="listbox" aria-label="Matvarer">
        {filteredFoods.length === 0 ? (
          <p className="motus-food-log-form__empty">Ingen matvarer matcher søket.</p>
        ) : (
          filteredFoods.map((item) => (
            <button
              key={item.id}
              type="button"
              role="option"
              aria-selected={item.id === selectedFoodId}
              className={`motus-food-log-form__food-option ${item.id === selectedFoodId ? "motus-food-log-form__food-option--active" : ""}`}
              onClick={() => setSelectedFoodId(item.id)}
            >
              <span className="motus-food-log-form__food-name">{item.name}</span>
              <span className="motus-food-log-form__food-meta">{defaultPortionGramsForFood(item)} g / 100g</span>
            </button>
          ))
        )}
      </div>
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
