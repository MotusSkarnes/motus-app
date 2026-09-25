import { useMemo, useState } from "react";
import { Plus, Scale, Trash2 } from "lucide-react";
import type { FoodItem } from "../app/foodBankTypes";
import { formatMacro } from "../app/foodBankTypes";
import { defaultPortionGramsForFood } from "../app/foodPortionDefaults";
import {
  formatGramsAmount,
  gramsForIngredientDraft,
  missingRecipeUnitsForFood,
  registeredRecipeUnitsForFood,
} from "../app/foodUnitGrams";
import { computeMacrosForGrams } from "../app/mealPlanMacros";
import {
  suggestRecipeDisplayName,
  type RecipeIngredientDraft,
} from "../app/recipeBody";
import { findFoodItemById } from "../app/foodBankDedup";
import { searchFoodBankItems } from "../app/foodBankSearch";
import { uid } from "../app/storage";
import { OutlineButton, TextInput } from "../app/ui";

type RecipeIngredientEditorProps = {
  ingredients: RecipeIngredientDraft[];
  foodItems: FoodItem[];
  disabled?: boolean;
  onChange: (ingredients: RecipeIngredientDraft[]) => void;
  onRegisterUnitGrams?: (foodId: string, unit: string, gramsPerUnit: number) => void;
};

type WeightPrompt = {
  foodId: string;
  foodName: string;
  unit: string;
  grams: string;
  rowId?: string;
  missingUnits: string[];
};

function UnitSelect({
  value,
  food,
  disabled,
  ariaLabel,
  onChange,
}: {
  value: string;
  food: FoodItem | null;
  disabled?: boolean;
  ariaLabel?: string;
  onChange: (unit: string) => void;
}) {
  const options = [...registeredRecipeUnitsForFood(food)];
  if (value && !options.includes(value)) options.unshift(value);
  const selected = options.includes(value) ? value : options[0] ?? "g";
  return (
    <select value={selected} onChange={(event) => onChange(event.target.value)} disabled={disabled} aria-label={ariaLabel}>
      {options.map((item) => (
        <option key={item} value={item}>
          {item}
        </option>
      ))}
    </select>
  );
}

function bankLineText(food: FoodItem | undefined, row: RecipeIngredientDraft): { text: string; missing: boolean } {
  const bankName = food?.name?.trim() || row.name.trim() || "Ingrediens";
  const grams = gramsForIngredientDraft(row.quantity, row.unit, food);
  if (grams != null && grams > 0 && food) {
    const macros = computeMacrosForGrams(food.nutritionPer100g, grams);
    return {
      text: `${bankName} · ${formatGramsAmount(grams)} · ${formatMacro(macros.kcal)} kcal · P ${formatMacro(macros.protein, 1)} · K ${formatMacro(macros.carbs, 1)} · F ${formatMacro(macros.fat, 1)}`,
      missing: false,
    };
  }
  if (grams != null && grams > 0) {
    return { text: `${bankName} · ${formatGramsAmount(grams)}`, missing: false };
  }
  if (food && row.unit.trim() && row.unit.trim() !== "g" && row.unit.trim() !== "kg") {
    return { text: `${bankName} · mangler vekt for ${row.unit.trim()}`, missing: true };
  }
  return { text: bankName, missing: false };
}

function WeightForm({
  prompt,
  disabled,
  onUnitChange,
  onGramsChange,
  onSave,
  onCancel,
}: {
  prompt: WeightPrompt;
  disabled?: boolean;
  onUnitChange: (unit: string) => void;
  onGramsChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="motus-recipe-ingredient-editor__weight-form">
      <label>
        <span>Enhet</span>
        <select
          value={prompt.unit}
          onChange={(event) => onUnitChange(event.target.value)}
          disabled={disabled}
          aria-label={`Enhet for vekt på ${prompt.foodName}`}
        >
          {prompt.missingUnits.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Gram per 1 {prompt.unit} {prompt.foodName}</span>
        <TextInput
          value={prompt.grams}
          onChange={(event) => onGramsChange(event.target.value)}
          inputMode="decimal"
          placeholder="15"
          disabled={disabled}
          aria-label={`Gram per 1 ${prompt.unit} ${prompt.foodName}`}
        />
      </label>
      <OutlineButton type="button" onClick={onSave} disabled={disabled}>
        Lagre vekt
      </OutlineButton>
      <button type="button" className="motus-recipe-ingredient-editor__weight-cancel" onClick={onCancel} disabled={disabled}>
        Avbryt
      </button>
    </div>
  );
}

export function RecipeIngredientEditor({
  ingredients,
  foodItems,
  disabled = false,
  onChange,
  onRegisterUnitGrams,
}: RecipeIngredientEditorProps) {
  const [search, setSearch] = useState("");
  const [selectedFood, setSelectedFood] = useState<FoodItem | null>(null);
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("g");
  const [customName, setCustomName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [weightPrompt, setWeightPrompt] = useState<WeightPrompt | null>(null);

  const filteredFoods = useMemo(() => searchFoodBankItems(foodItems, search, 20), [foodItems, search]);

  const selectedFoodLive = selectedFood
    ? findFoodItemById(foodItems, selectedFood.id) ?? selectedFood
    : null;
  const addMissingUnits = selectedFoodLive ? missingRecipeUnitsForFood(selectedFoodLive) : [];

  function resetAddForm() {
    setSearch("");
    setSelectedFood(null);
    setQuantity("");
    setUnit("g");
    setCustomName("");
    setError(null);
    setWeightPrompt(null);
  }

  function selectFood(food: FoodItem) {
    setSelectedFood(food);
    setSearch("");
    setCustomName("");
    setUnit("g");
    setQuantity(String(defaultPortionGramsForFood(food) || 100));
    setError(null);
    setWeightPrompt(null);
  }

  function openWeightPrompt(food: FoodItem, rowId?: string, preferredUnit?: string) {
    const currentUnit = preferredUnit?.trim() ?? "";
    const editableCurrentUnit = currentUnit && currentUnit !== "g" && currentUnit !== "kg" ? currentUnit : "";
    const units = [...new Set([editableCurrentUnit, ...missingRecipeUnitsForFood(food)].filter(Boolean))];
    if (!units.length) {
      setWeightPrompt(null);
      return;
    }
    const existingGrams = editableCurrentUnit ? gramsForIngredientDraft("1", editableCurrentUnit, food) : null;
    setWeightPrompt({
      foodId: food.id,
      foodName: food.name,
      unit: units[0] ?? "ss",
      grams: existingGrams != null ? String(existingGrams).replace(".", ",") : "",
      rowId,
      missingUnits: units,
    });
    setError(null);
  }

  function saveWeightPrompt() {
    if (!weightPrompt || !onRegisterUnitGrams) return;
    const grams = Number.parseFloat(weightPrompt.grams.trim().replace(",", "."));
    if (!Number.isFinite(grams) || grams <= 0) {
      setError("Skriv inn gram per enhet, f.eks. 15.");
      return;
    }
    onRegisterUnitGrams(weightPrompt.foodId, weightPrompt.unit, grams);
    if (weightPrompt.rowId) {
      updateRow(weightPrompt.rowId, { unit: weightPrompt.unit });
    } else {
      setUnit(weightPrompt.unit);
    }
    setWeightPrompt(null);
    setError(null);
  }

  function updateWeightPromptUnit(nextUnit: string, food: FoodItem | null | undefined) {
    const grams = gramsForIngredientDraft("1", nextUnit, food);
    setWeightPrompt((current) =>
      current ? { ...current, unit: nextUnit, grams: grams != null ? String(grams).replace(".", ",") : "" } : current,
    );
  }

  function addIngredient() {
    const name = suggestRecipeDisplayName((selectedFoodLive?.name ?? customName).trim());
    if (!name) {
      setError("Søk opp en matvare, eller skriv inn navn på ingrediensen.");
      return;
    }
    const qty = quantity.trim();
    if (selectedFoodLive && !qty) {
      setError("Skriv inn mengde.");
      return;
    }
    onChange([
      ...ingredients,
      {
        id: uid("ing"),
        quantity: qty,
        unit: unit.trim(),
        name,
        ...(selectedFoodLive ? { foodId: selectedFoodLive.id } : {}),
      },
    ]);
    resetAddForm();
  }

  function updateRow(id: string, patch: Partial<RecipeIngredientDraft>) {
    onChange(ingredients.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function removeRow(id: string) {
    onChange(ingredients.filter((row) => row.id !== id));
  }

  return (
    <section className="motus-recipe-ingredient-editor" aria-label="Ingredienser">
      <div className="motus-recipe-ingredient-editor__head">
        <h3>Ingredienser</h3>
        <p>
          Søk i matvarebanken og legg til mengde. Rullegardinen viser bare enheter med vekt. Bruk vekt-knappen for å
          legge inn enheter du veier selv.
        </p>
      </div>

      {selectedFoodLive ? (
        <div className="motus-recipe-ingredient-editor__selected">
          <div>
            <p className="motus-recipe-ingredient-editor__selected-name">{selectedFoodLive.name}</p>
            <p className="motus-recipe-ingredient-editor__hint">Fra matvarebanken — næringsinnhold beregnes automatisk.</p>
          </div>
          <button type="button" className="motus-recipe-ingredient-swap-btn" onClick={resetAddForm} disabled={disabled}>
            Bytt
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <TextInput
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setError(null);
            }}
            placeholder="Søk matvare, f.eks. kyllingbryst"
            disabled={disabled}
            aria-label="Søk matvare"
          />
          {search.trim() ? (
            <div className="motus-recipe-ingredient-editor__results" role="listbox" aria-label="Matvarer">
              {filteredFoods.length === 0 ? (
                <p className="motus-recipe-ingredient-editor__hint">Ingen treff. Skriv navnet under og legg til likevel.</p>
              ) : (
                filteredFoods.map((food) => (
                  <button
                    key={food.id}
                    type="button"
                    className="motus-recipe-ingredient-editor__result"
                    onClick={() => selectFood(food)}
                    disabled={disabled}
                  >
                    <span aria-hidden>{food.imageEmoji ?? "🍽️"}</span>
                    <span>{food.name}</span>
                  </button>
                ))
              )}
            </div>
          ) : null}
          <TextInput
            value={customName}
            onChange={(event) => {
              setCustomName(event.target.value);
              setError(null);
            }}
            placeholder="Eller skriv ingrediens, f.eks. salt og pepper"
            disabled={disabled}
            aria-label="Egen ingrediens"
          />
        </div>
      )}

      <div className="motus-recipe-ingredient-editor__add-row">
        <label className="motus-recipe-ingredient-editor__qty">
          <span>Mengde</span>
          <TextInput
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            inputMode="decimal"
            placeholder="200"
            disabled={disabled}
          />
        </label>
        <div className="motus-recipe-ingredient-editor__unit">
          <span>Enhet</span>
          <div className="motus-recipe-ingredient-editor__unit-wrap">
            <UnitSelect
              value={unit}
              food={selectedFoodLive}
              disabled={disabled}
              ariaLabel="Enhet"
              onChange={setUnit}
            />
            {addMissingUnits.length > 0 && onRegisterUnitGrams ? (
              <button
                type="button"
                className="motus-recipe-ingredient-editor__unit-weight-btn"
                onClick={() => selectedFoodLive && openWeightPrompt(selectedFoodLive, undefined, unit)}
                disabled={disabled}
                title={`Legg inn eller endre enhetsvekt på ${selectedFoodLive?.name ?? "matvaren"}`}
                aria-label={`Legg inn eller endre enhetsvekt på ${selectedFoodLive?.name ?? "matvaren"}`}
              >
                <Scale className="h-4 w-4" aria-hidden />
              </button>
            ) : null}
          </div>
        </div>
        <OutlineButton type="button" onClick={addIngredient} disabled={disabled} className="motus-recipe-ingredient-editor__add-btn">
          <Plus className="mr-1 h-4 w-4" aria-hidden />
          Legg til
        </OutlineButton>
      </div>
      {weightPrompt && !weightPrompt.rowId && weightPrompt.foodId === selectedFoodLive?.id ? (
        <WeightForm
          prompt={weightPrompt}
          disabled={disabled}
          onUnitChange={(next) => updateWeightPromptUnit(next, selectedFoodLive)}
          onGramsChange={(value) => setWeightPrompt((current) => (current ? { ...current, grams: value } : current))}
          onSave={saveWeightPrompt}
          onCancel={() => setWeightPrompt(null)}
        />
      ) : null}
      {error ? <p className="motus-recipe-ingredient-editor__error">{error}</p> : null}

      {ingredients.length > 0 ? (
        <>
          <div className="motus-recipe-ingredient-editor__item-fields motus-recipe-ingredient-editor__item-fields--labels">
            <span>Mengde</span>
            <span>Enhet</span>
            <span>Fra matvarebanken</span>
            <span className="sr-only">Fjern</span>
          </div>
          <ul className="motus-recipe-ingredient-editor__list">
            {ingredients.map((row) => {
              const food = findFoodItemById(foodItems, row.foodId);
              const line = bankLineText(food, row);
              const rowMissingUnits = food ? missingRecipeUnitsForFood(food) : [];
              const promptMatches = weightPrompt?.rowId === row.id;
              return (
                <li key={row.id} className="motus-recipe-ingredient-editor__item">
                  <div className="motus-recipe-ingredient-editor__item-fields">
                    <TextInput
                      value={row.quantity}
                      onChange={(event) => updateRow(row.id, { quantity: event.target.value })}
                      inputMode="decimal"
                      aria-label={`Mengde for ${food?.name ?? row.name}`}
                      disabled={disabled}
                    />
                    <div className="motus-recipe-ingredient-editor__unit-wrap">
                      <UnitSelect
                        value={row.unit}
                        food={food ?? null}
                        disabled={disabled}
                        ariaLabel={`Enhet for ${food?.name ?? row.name}`}
                        onChange={(next) => updateRow(row.id, { unit: next })}
                      />
                      {rowMissingUnits.length > 0 && onRegisterUnitGrams ? (
                        <button
                          type="button"
                          className="motus-recipe-ingredient-editor__unit-weight-btn"
                          onClick={() => food && openWeightPrompt(food, row.id, row.unit)}
                          disabled={disabled}
                          title={`Legg inn eller endre enhetsvekt på ${food?.name ?? "matvaren"}`}
                          aria-label={`Legg inn eller endre enhetsvekt på ${food?.name ?? "matvaren"}`}
                        >
                          <Scale className="h-4 w-4" aria-hidden />
                        </button>
                      ) : null}
                    </div>
                    <p
                      className={`motus-recipe-ingredient-editor__bank-line${line.missing ? " motus-recipe-ingredient-editor__bank-line--muted" : ""}`}
                      title={line.text}
                    >
                      {line.text}
                    </p>
                    <button
                      type="button"
                      className="motus-recipe-ingredient-editor__remove"
                      onClick={() => removeRow(row.id)}
                      aria-label={`Fjern ${food?.name ?? row.name}`}
                      disabled={disabled}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                  {promptMatches && weightPrompt ? (
                    <WeightForm
                      prompt={weightPrompt}
                      disabled={disabled}
                      onUnitChange={(next) => updateWeightPromptUnit(next, food)}
                      onGramsChange={(value) => setWeightPrompt((current) => (current ? { ...current, grams: value } : current))}
                      onSave={saveWeightPrompt}
                      onCancel={() => setWeightPrompt(null)}
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <p className="motus-recipe-ingredient-editor__empty">Ingen ingredienser lagt til ennå.</p>
      )}
    </section>
  );
}
