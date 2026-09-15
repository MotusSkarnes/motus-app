import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { FoodItem } from "../app/foodBankTypes";
import { defaultPortionGramsForFood } from "../app/foodPortionDefaults";
import {
  RECIPE_INGREDIENT_UNITS,
  formatRecipeIngredientLine,
  type RecipeIngredientDraft,
} from "../app/recipeBody";
import { uid } from "../app/storage";
import { OutlineButton, TextInput } from "../app/ui";

type RecipeIngredientEditorProps = {
  ingredients: RecipeIngredientDraft[];
  foodItems: FoodItem[];
  disabled?: boolean;
  onChange: (ingredients: RecipeIngredientDraft[]) => void;
};

export function RecipeIngredientEditor({
  ingredients,
  foodItems,
  disabled = false,
  onChange,
}: RecipeIngredientEditorProps) {
  const [search, setSearch] = useState("");
  const [selectedFood, setSelectedFood] = useState<FoodItem | null>(null);
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("g");
  const [customName, setCustomName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const filteredFoods = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return foodItems
      .filter((item) => `${item.name} ${item.origin}`.toLowerCase().includes(q))
      .slice(0, 12);
  }, [foodItems, search]);

  function resetAddForm() {
    setSearch("");
    setSelectedFood(null);
    setQuantity("");
    setUnit("g");
    setCustomName("");
    setError(null);
  }

  function selectFood(food: FoodItem) {
    setSelectedFood(food);
    setSearch("");
    setCustomName("");
    setUnit("g");
    setQuantity(String(defaultPortionGramsForFood(food) || 100));
    setError(null);
  }

  function addIngredient() {
    const name = (selectedFood?.name ?? customName).trim();
    if (!name) {
      setError("Søk opp en matvare, eller skriv inn navn på ingrediensen.");
      return;
    }
    const qty = quantity.trim();
    if (!selectedFood && !qty && !name) {
      setError("Søk opp en matvare, eller skriv inn navn på ingrediensen.");
      return;
    }
    if (selectedFood && !qty) {
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
        ...(selectedFood ? { foodId: selectedFood.id } : {}),
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
        <p>Søk i matvarebanken og legg til mengde. Du kan også skrive inn en ingrediens som ikke ligger i banken.</p>
      </div>

      {selectedFood ? (
        <div className="motus-recipe-ingredient-editor__selected">
          <div>
            <p className="motus-recipe-ingredient-editor__selected-name">{selectedFood.name}</p>
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
        <label className="motus-recipe-ingredient-editor__unit">
          <span>Enhet</span>
          <select
            value={unit}
            onChange={(event) => setUnit(event.target.value)}
            disabled={disabled}
          >
            {RECIPE_INGREDIENT_UNITS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <OutlineButton type="button" onClick={addIngredient} disabled={disabled} className="motus-recipe-ingredient-editor__add-btn">
          <Plus className="mr-1 h-4 w-4" aria-hidden />
          Legg til
        </OutlineButton>
      </div>
      {error ? <p className="motus-recipe-ingredient-editor__error">{error}</p> : null}

      {ingredients.length > 0 ? (
        <ul className="motus-recipe-ingredient-editor__list">
          {ingredients.map((row) => (
            <li key={row.id} className="motus-recipe-ingredient-editor__item">
              <div className="motus-recipe-ingredient-editor__item-fields">
                <TextInput
                  value={row.quantity}
                  onChange={(event) => updateRow(row.id, { quantity: event.target.value })}
                  inputMode="decimal"
                  aria-label={`Mengde for ${row.name}`}
                  disabled={disabled}
                />
                <select
                  value={RECIPE_INGREDIENT_UNITS.includes(row.unit as (typeof RECIPE_INGREDIENT_UNITS)[number]) ? row.unit : row.unit || "g"}
                  onChange={(event) => updateRow(row.id, { unit: event.target.value })}
                  aria-label={`Enhet for ${row.name}`}
                  disabled={disabled}
                >
                  {!RECIPE_INGREDIENT_UNITS.includes(row.unit as (typeof RECIPE_INGREDIENT_UNITS)[number]) && row.unit ? (
                    <option value={row.unit}>{row.unit}</option>
                  ) : null}
                  {RECIPE_INGREDIENT_UNITS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
                <TextInput
                  value={row.name}
                  onChange={(event) => updateRow(row.id, { name: event.target.value })}
                  aria-label="Ingrediensnavn"
                  disabled={disabled}
                />
              </div>
              <div className="motus-recipe-ingredient-editor__item-meta">
                <span>{formatRecipeIngredientLine(row)}</span>
                <button
                  type="button"
                  className="motus-recipe-ingredient-editor__remove"
                  onClick={() => removeRow(row.id)}
                  aria-label={`Fjern ${row.name}`}
                  disabled={disabled}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="motus-recipe-ingredient-editor__empty">Ingen ingredienser lagt til ennå.</p>
      )}
    </section>
  );
}
