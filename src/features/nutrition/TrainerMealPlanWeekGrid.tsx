import { Fragment } from "react";
import { MoreHorizontal, Plus, Soup, UtensilsCrossed } from "lucide-react";
import type { InspirationRecipeItem } from "../../app/inspirationRecipeItems";
import {
  PLANNER_MEAL_SLOTS,
  findMealForSlot,
  mealCellDisplayTitle,
  resolveMealCellImage,
} from "../../app/mealPlanWeekPlanner";
import type { FoodItem } from "../../app/foodBankTypes";
import { formatMacro } from "../../app/foodBankTypes";
import { computeMealMacros } from "../../app/mealPlanMacros";
import type { MealPlan } from "../../app/mealPlanTypes";

export type MealGridSelection = { dayId: string; mealId: string };

type TrainerMealPlanWeekGridProps = {
  plan: MealPlan;
  foodById: Map<string, FoodItem>;
  recipesById: Map<string, InspirationRecipeItem>;
  selection: MealGridSelection | null;
  onSelect: (selection: MealGridSelection) => void;
  onAddFood: (selection: MealGridSelection) => void;
  onAddRecipe: (selection: MealGridSelection) => void;
  onClearMeal: (selection: MealGridSelection) => void;
};

export function TrainerMealPlanWeekGrid({
  plan,
  foodById,
  recipesById,
  selection,
  onSelect,
  onAddFood,
  onAddRecipe,
  onClearMeal,
}: TrainerMealPlanWeekGridProps) {
  const weekdayShort = (label: string) => label.slice(0, 3);

  return (
    <div className="motus-pt-planner-grid-wrap">
      <div className="motus-pt-planner-grid" role="grid" aria-label="Ukematplan">
        <div className="motus-pt-planner-grid__corner" />
        {plan.days.map((day) => (
          <div key={day.id} className="motus-pt-planner-grid__day-head" role="columnheader">
            {weekdayShort(day.label)}
          </div>
        ))}

        {PLANNER_MEAL_SLOTS.map((slot) => (
          <Fragment key={slot}>
            <div className="motus-pt-planner-grid__row-head" role="rowheader">
              {slot}
            </div>
            {plan.days.map((day) => {
              const meal = findMealForSlot(day, slot);
              if (!meal) {
                return <div key={`${day.id}-${slot}`} className="motus-pt-planner-grid__cell motus-pt-planner-grid__cell--empty" />;
              }
              const selected = selection?.dayId === day.id && selection?.mealId === meal.id;
              const hasFood = meal.items.length > 0;
              const title = mealCellDisplayTitle(meal);
              const imageSrc = resolveMealCellImage(meal, foodById, recipesById);
              const macros = computeMealMacros(meal, foodById);
              const cellSelection = { dayId: day.id, mealId: meal.id };

              return (
                <div
                  key={`${day.id}-${meal.id}`}
                  className={`motus-pt-planner-grid__cell ${selected ? "motus-pt-planner-grid__cell--selected" : ""} ${hasFood ? "motus-pt-planner-grid__cell--filled" : ""}`}
                  role="gridcell"
                >
                  <button
                    type="button"
                    className="motus-pt-planner-grid__card motus-pressable"
                    onClick={() => onSelect(cellSelection)}
                  >
                    {hasFood ? (
                      <>
                        {imageSrc ? (
                          <img src={imageSrc} alt="" className="motus-pt-planner-grid__img" loading="lazy" />
                        ) : (
                          <div className="motus-pt-planner-grid__img motus-pt-planner-grid__img--placeholder" aria-hidden>
                            <UtensilsCrossed className="h-5 w-5 text-white/80" />
                          </div>
                        )}
                        <div className="motus-pt-planner-grid__card-body">
                          <span className="motus-pt-planner-grid__card-title">{title}</span>
                          <span className="motus-pt-planner-grid__card-meta">
                            {formatMacro(macros.kcal, 0)} kcal
                            {meal.items.length > 1 ? ` · +${meal.items.length - 1}` : ""}
                          </span>
                        </div>
                      </>
                    ) : (
                      <span className="motus-pt-planner-grid__empty">
                        <Plus className="h-4 w-4" aria-hidden />
                        Legg til
                      </span>
                    )}
                  </button>
                  <div className="motus-pt-planner-grid__menu">
                    <button
                      type="button"
                      className="motus-pt-planner-grid__menu-btn motus-pressable"
                      aria-label={`Meny ${slot} ${day.label}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelect(cellSelection);
                      }}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                    {selected ? (
                      <div className="motus-pt-planner-grid__dropdown">
                        <button type="button" onClick={() => onAddFood(cellSelection)}>
                          <Plus className="h-3.5 w-3.5" aria-hidden />
                          Matvare
                        </button>
                        <button type="button" onClick={() => onAddRecipe(cellSelection)}>
                          <Soup className="h-3.5 w-3.5" aria-hidden />
                          Oppskrift
                        </button>
                        {hasFood ? (
                          <button type="button" onClick={() => onClearMeal(cellSelection)}>
                            Tøm celle
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
