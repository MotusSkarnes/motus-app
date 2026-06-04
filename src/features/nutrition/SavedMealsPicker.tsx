import { Bookmark, ChevronDown, Trash2 } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { formatMacro } from "../../app/foodBankTypes";
import { memberMealSlotLabel } from "../../app/memberMealSlots";
import type { MemberSavedMeal } from "../../app/memberSavedMeals";
import { sumQuickFoodLogMacros } from "../../app/quickFoodLogMacros";
import { TextInput } from "../../app/ui";

function filterSavedMeals(meals: MemberSavedMeal[], query: string): MemberSavedMeal[] {
  const q = query.trim().toLowerCase();
  if (!q) return meals;
  return meals.filter((meal) => {
    const slot = meal.mealSlotId ? memberMealSlotLabel(meal.mealSlotId) : "";
    const itemNames = meal.items.map((item) => item.name).join(" ");
    const haystack = `${meal.name} ${slot} ${itemNames}`.toLowerCase();
    return haystack.includes(q);
  });
}

function savedMealMetaLine(meal: MemberSavedMeal): string {
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
  const parts = [
    `${meal.items.length} ${meal.items.length === 1 ? "vare" : "varer"}`,
    `${formatMacro(macros.kcal, 0)} kcal`,
  ];
  if (meal.mealSlotId) parts.push(memberMealSlotLabel(meal.mealSlotId));
  return parts.join(" · ");
}

type SavedMealsPickerProps = {
  meals: MemberSavedMeal[];
  slotLabel: string;
  onSelect: (meal: MemberSavedMeal) => void;
  onDelete: (savedMealId: string) => void;
};

export function SavedMealsPicker({ meals, slotLabel, onSelect, onDelete }: SavedMealsPickerProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const filtered = useMemo(() => filterSavedMeals(meals, query), [meals, query]);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  function pickMeal(meal: MemberSavedMeal) {
    onSelect(meal);
    setQuery("");
    setOpen(false);
  }

  return (
    <section className="motus-saved-meals-picker" aria-label="Lagrede måltider">
      <h3 className="motus-saved-meals-picker__title">
        <Bookmark className="h-4 w-4" aria-hidden />
        Lagrede måltider
        <span className="motus-saved-meals-picker__count">{meals.length}</span>
      </h3>
      <p className="motus-saved-meals-picker__lead">
        Søk og velg — hentes inn til {slotLabel.toLowerCase()} før du logger.
      </p>
      <div ref={rootRef} className="motus-saved-meals-picker__combobox relative">
        <div className="relative">
          <TextInput
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder="Søk eller velg lagret måltid…"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            className="pr-9"
          />
          <button
            type="button"
            tabIndex={-1}
            className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-slate-500"
            aria-label="Vis lagrede måltider"
            onMouseDown={(event) => {
              event.preventDefault();
              setOpen((prev) => !prev);
            }}
          >
            <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} aria-hidden />
          </button>
        </div>
        {open ? (
          <ul
            id={listId}
            role="listbox"
            className="motus-saved-meals-picker__list absolute z-20 mt-1 max-h-52 w-full overflow-y-auto"
          >
            {filtered.length > 0 ? (
              filtered.map((meal) => (
                <li key={meal.id} role="option" aria-selected={false} className="motus-saved-meals-picker__option">
                  <button
                    type="button"
                    className="motus-saved-meals-picker__option-main motus-pressable"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      pickMeal(meal);
                    }}
                  >
                    <span className="motus-saved-meals-picker__option-name">{meal.name}</span>
                    <span className="motus-saved-meals-picker__option-meta">{savedMealMetaLine(meal)}</span>
                  </button>
                  <button
                    type="button"
                    className="motus-saved-meals-picker__option-delete motus-pressable"
                    aria-label={`Slett ${meal.name}`}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onDelete(meal.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </li>
              ))
            ) : (
              <li className="motus-saved-meals-picker__empty">Ingen lagrede måltider matcher søket.</li>
            )}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
