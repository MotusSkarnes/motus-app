import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { formatMacro, type FoodItem } from "../../app/foodBankTypes";
import { defaultPortionGramsForFood } from "../../app/foodPortionDefaults";
import type { MemberQuickFoodLogEntry } from "../../app/memberMealPlanState";
import { useFoodBankItems } from "../../app/useFoodBankItems";
import { OutlineButton, TextInput } from "../../app/ui";

export type SelfLogDraft = Omit<MemberQuickFoodLogEntry, "id" | "loggedAt">;

type InlineMealSelfLogProps = {
  mealId: string;
  onAdd: (entry: SelfLogDraft) => void;
  compact?: boolean;
  autoOpen?: boolean;
};

export function createSelfLogEntry(
  food: FoodItem,
  grams: number,
  mealId: string,
): SelfLogDraft {
  return {
    name: food.name,
    grams: Math.round(grams),
    source: "food",
    mealId,
    nutritionPer100g: { ...food.nutritionPer100g },
  };
}

export function InlineMealSelfLog({ mealId, onAdd, compact = false, autoOpen = false }: InlineMealSelfLogProps) {
  const foodItems = useFoodBankItems();
  const [open, setOpen] = useState(autoOpen);
  const [search, setSearch] = useState("");
  const [selectedFoodId, setSelectedFoodId] = useState("");
  const [gramsInput, setGramsInput] = useState("100");
  const [error, setError] = useState<string | null>(null);

  const filteredFoods = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return foodItems.slice(0, 15);
    return foodItems.filter((item) => item.name.toLowerCase().includes(q)).slice(0, 15);
  }, [foodItems, search]);

  const selectedFood = useMemo(
    () => foodItems.find((item) => item.id === selectedFoodId) ?? null,
    [foodItems, selectedFoodId],
  );

  useEffect(() => {
    if (!selectedFood) return;
    setGramsInput(String(defaultPortionGramsForFood(selectedFood)));
  }, [selectedFood]);

  const handleAdd = useCallback(() => {
    if (!selectedFood) {
      setError("Velg en matvare.");
      return;
    }
    const grams = Number(gramsInput.replace(",", "."));
    if (!Number.isFinite(grams) || grams <= 0) {
      setError("Skriv inn gyldig gram.");
      return;
    }
    onAdd(createSelfLogEntry(selectedFood, grams, mealId));
    setError(null);
    setSearch("");
    setSelectedFoodId("");
    setGramsInput(String(defaultPortionGramsForFood(selectedFood)));
    setOpen(autoOpen);
  }, [gramsInput, mealId, onAdd, selectedFood, autoOpen]);

  if (!open) {
    return (
      <button
        type="button"
        className="motus-matplan-self-log-trigger motus-pressable"
        onClick={() => setOpen(true)}
      >
        <Plus className="h-3.5 w-3.5" aria-hidden />
        Logg noe annet
      </button>
    );
  }

  return (
    <div className={`motus-matplan-self-log ${compact ? "motus-matplan-self-log--compact" : ""}`}>
      <p className="motus-matplan-self-log__label">Logg det du spiste</p>
      <TextInput
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Søk matvare…"
        className="motus-matplan-self-log__search"
      />
      <div className="motus-matplan-self-log__row">
        <select
          value={selectedFoodId}
          onChange={(e) => setSelectedFoodId(e.target.value)}
          className="motus-matplan-self-log__select"
        >
          <option value="">Velg matvare</option>
              {filteredFoods.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({defaultPortionGramsForFood(item)} g)
                </option>
              ))}
        </select>
        <TextInput
          value={gramsInput}
          onChange={(e) => setGramsInput(e.target.value)}
          inputMode="decimal"
          placeholder="Gram"
          className="motus-matplan-self-log__grams"
        />
        <OutlineButton type="button" onClick={handleAdd}>
          Logg
        </OutlineButton>
      </div>
      {selectedFood ? (
        <p className="motus-matplan-self-log__preview">
          {selectedFood.name} · {formatMacro(Number(gramsInput.replace(",", ".")) || 0, 0)} g
        </p>
      ) : null}
      {error ? <p className="motus-matplan-self-log__error">{error}</p> : null}
      <button type="button" className="motus-matplan-self-log__cancel motus-pressable" onClick={() => setOpen(false)}>
        Avbryt
      </button>
    </div>
  );
}
