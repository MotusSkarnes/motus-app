import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { searchFoodBankItems } from "../app/foodBankSearch";
import { formatMacro } from "../app/foodBankTypes";
import type { FoodItem } from "../app/foodBankTypes";
import { GradientButton, OutlineButton, TextInput } from "../app/ui";

type RecipeFoodSelectModalProps = {
  open: boolean;
  ingredientLabel: string;
  foodItems: FoodItem[];
  selectedFoodId?: string;
  initialGrams?: number;
  onClose: () => void;
  onSelect: (foodId: string, grams: number) => void;
};

export function RecipeFoodSelectModal({
  open,
  ingredientLabel,
  foodItems,
  selectedFoodId,
  initialGrams = 100,
  onClose,
  onSelect,
}: RecipeFoodSelectModalProps) {
  const [search, setSearch] = useState("");
  const [pendingFoodId, setPendingFoodId] = useState(selectedFoodId ?? "");
  const [gramsInput, setGramsInput] = useState(String(Math.max(1, Math.round(initialGrams))));

  const filteredFoods = useMemo(
    () => (search.trim() ? searchFoodBankItems(foodItems, search, 80) : foodItems.slice(0, 80)),
    [foodItems, search],
  );

  if (!open) return null;

  return (
    <div className="motus-foodbank-modal-backdrop" role="presentation">
      <div
        className="motus-foodbank-modal motus-foodbank-modal--wide motus-recipe-ingredient-swap-modal"
        role="dialog"
        aria-labelledby="recipe-food-select-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="motus-foodbank-modal-head">
          <h2 id="recipe-food-select-title" className="text-base font-bold text-slate-900">
            Velg matvare
          </h2>
          <button type="button" className="motus-foodbank-icon-btn" onClick={onClose} aria-label="Lukk">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="motus-foodbank-modal-body space-y-3">
          <p className="text-sm text-slate-600">
            Koble ingrediensen <strong>{ingredientLabel}</strong> til riktig vare i matvarebanken.
          </p>
          <label className="motus-foodbank-search">
            <Search className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Søk i matvarebank …"
              aria-label="Søk matvare"
              autoFocus
            />
          </label>
          <div className="max-h-[min(50vh,24rem)] space-y-1 overflow-y-auto">
            {filteredFoods.length === 0 ? (
              <p className="rounded-xl border border-amber-100 bg-amber-50/80 px-3 py-2 text-xs text-amber-900">
                Ingen matvarer funnet. Prøv et annet søk eller legg varen i matvarebanken først.
              </p>
            ) : (
              filteredFoods.map((food) => {
                const selected = food.id === pendingFoodId;
                const n = food.nutritionPer100g;
                return (
                  <button
                    key={food.id}
                    type="button"
                    className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition ${
                      selected
                        ? "border-teal-300 bg-teal-50 ring-1 ring-teal-200"
                        : "border-slate-100 hover:border-teal-200 hover:bg-teal-50/60"
                    }`}
                    onClick={() => setPendingFoodId(food.id)}
                  >
                    <span className="text-lg" aria-hidden>
                      {food.imageEmoji ?? "🍽️"}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-slate-900">{food.name}</span>
                      <span className="block text-xs text-slate-500">
                        {food.origin} · per 100 g: {Math.round(n.kcal)} kcal · {formatMacro(n.protein)} P
                      </span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
          {pendingFoodId ? (
            <label className="space-y-1 text-xs font-medium text-slate-700">
              <span>Mengde i gram</span>
              <TextInput value={gramsInput} inputMode="decimal" onChange={(event) => setGramsInput(event.target.value)} />
            </label>
          ) : null}
          <div className="flex justify-end gap-2">
            <OutlineButton type="button" onClick={onClose}>
              Avbryt
            </OutlineButton>
            <GradientButton
              type="button"
              disabled={!pendingFoodId || !(Number(gramsInput.replace(",", ".")) > 0)}
              onClick={() => onSelect(pendingFoodId, Number(gramsInput.replace(",", ".")))}
            >
              Lagre bytte
            </GradientButton>
          </div>
        </div>
      </div>
    </div>
  );
}
