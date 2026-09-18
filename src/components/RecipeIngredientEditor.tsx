import { useMemo, useState } from "react";
import { Plus, Scale, Trash2 } from "lucide-react";
import type { FoodItem } from "../app/foodBankTypes";
import { formatMacro } from "../app/foodBankTypes";
import { defaultPortionGramsForFood } from "../app/foodPortionDefaults";
import {
  formatGramsAmount,
  gramsForIngredientDraft,
  hasRegisteredUnitWeight,
} from "../app/foodUnitGrams";
import { computeMacrosForGrams } from "../app/mealPlanMacros";
import {
  RECIPE_INGREDIENT_UNITS,
  suggestRecipeDisplayName,
  type RecipeIngredientDraft,
} from "../app/recipeBody";
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
  const selected = RECIPE_INGREDIENT_UNITS.includes(value as (typeof RECIPE_INGREDIENT_UNITS)[number])
    ? value
    : value || "g";
  const selectedMissing = Boolean(food && selected && !hasRegisteredUnitWeight(food, selected));
  return (
    <select
      value={selected}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
      aria-label={ariaLabel}
      className={selectedMissing ? "is-missing-weight" : undefined}
    >
      {!RECIPE_INGREDIENT_UNITS.includes(value as (typeof RECIPE_INGREDIENT_UNITS)[number]) && value ? (
        <option value={value}>{value}</option>
      ) : null}
      {RECIPE_INGREDIENT_UNITS.map((item) => {
        const registered = !food || hasRegisteredUnitWeight(food, item);
        return (
          <option key={item} value={item} style={registered ? undefined : { color: "#94a3b8" }}>
            {item}
          </option>
        );
      })}
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
  onGramsChange,
  onSave,
  onCancel,
}: {
  prompt: WeightPrompt;
  disabled?: boolean;
  onGramsChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="motus-recipe-ingredient-editor__weight-form">
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

  const filteredFoods = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return foodItems
      .filter((item) => `${item.name} ${item.origin}`.toLowerCase().includes(q))
      .slice(0, 12);
  }, [foodItems, search]);

  const selectedFoodLive = selectedFood
    ? foodItems.find((item) => item.id === selectedFood.id) ?? selectedFood
    : null;
  const addNeedsWeight = Boolean(
    selectedFoodLive && unit.trim() && !hasRegisteredUnitWeight(selectedFoodLive, unit),
  );

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

  function openWeightPrompt(food: FoodItem, nextUnit: string, rowId?: string) {
    if (!nextUnit.trim() || hasRegisteredUnitWeight(food, nextUnit)) {
      setWeightPrompt(null);
      return;
    }
    setWeightPrompt({
      foodId: food.id,
      foodName: food.name,
      unit: nextUnit.trim(),
      grams: "",
      rowId,
    });
  }

  function saveWeightPrompt() {
    if (!weightPrompt || !onRegisterUnitGrams) return;
    const grams = Number.parseFloat(weightPrompt.grams.trim().replace(",", "."));
    if (!Number.isFinite(grams) || grams <= 0) {
      setError("Skriv inn gram per enhet, f.eks. 15.");
      return;
    }
    onRegisterUnitGrams(weightPrompt.foodId, weightPrompt.unit, grams);
    setWeightPrompt(null);
    setError(null);
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
          Søk i matvarebanken og legg til mengde. Linjen viser matvaren fra banken med gram og makro. Navnet kunden ser
          endrer du under — det påvirker ikke navnet i banken.
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
              onChange={setUnit}
            />
            {addNeedsWeight && onRegisterUnitGrams ? (
              <button
                type="button"
                className="motus-recipe-ingredient-editor__unit-weight-btn"
                onClick={() => selectedFoodLive && openWeightPrompt(selectedFoodLive, unit)}
                disabled={disabled}
                title={`Legg inn vekt for 1 ${unit} ${selectedFoodLive?.name ?? ""}`.trim()}
                aria-label={`Legg inn vekt for 1 ${unit} ${selectedFoodLive?.name ?? ""}`.trim()}
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
      {weightPrompt && !weightPrompt.rowId && weightPrompt.foodId === selectedFoodLive?.id && weightPrompt.unit === unit.trim() ? (
        <WeightForm
          prompt={weightPrompt}
          disabled={disabled}
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
              const food = row.foodId ? foodItems.find((item) => item.id === row.foodId) : undefined;
              const line = bankLineText(food, row);
              const rowNeedsWeight = Boolean(food && row.unit.trim() && !hasRegisteredUnitWeight(food, row.unit));
              const amount = [row.quantity.trim(), row.unit.trim()].filter(Boolean).join(" ");
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
                      {rowNeedsWeight && onRegisterUnitGrams ? (
                        <button
                          type="button"
                          className="motus-recipe-ingredient-editor__unit-weight-btn"
                          onClick={() => food && openWeightPrompt(food, row.unit, row.id)}
                          disabled={disabled}
                          title={`Legg inn vekt for 1 ${row.unit} ${food?.name ?? ""}`.trim()}
                          aria-label={`Legg inn vekt for 1 ${row.unit} ${food?.name ?? ""}`.trim()}
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
                      onGramsChange={(value) => setWeightPrompt((current) => (current ? { ...current, grams: value } : current))}
                      onSave={saveWeightPrompt}
                      onCancel={() => setWeightPrompt(null)}
                    />
                  ) : null}
                  <div className="motus-recipe-ingredient-editor__customer">
                    <span className="motus-recipe-ingredient-editor__customer-label">Kunden ser</span>
                    {amount ? <span className="motus-recipe-ingredient-editor__customer-amount">{amount}</span> : null}
                    <TextInput
                      value={row.name}
                      onChange={(event) => updateRow(row.id, { name: event.target.value })}
                      aria-label="Navn kunden ser"
                      disabled={disabled}
                    />
                  </div>
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
