import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Save, Search, Trash2, X } from "lucide-react";
import { MEAL_PLAN_CHANGED_EVENT } from "../app/mealPlanStorage";
import {
  persistMealPlanBundle,
  persistMealPlanLocalAndScheduleCloud,
  syncMealPlanForMember,
} from "../app/mealPlanCloud";
import { computeMealMacros, formatMacroTotals } from "../app/mealPlanMacros";
import type { MealPlan, MealPlanFoodEntry, MealPlanMeal, MealPlanTargets } from "../app/mealPlanTypes";
import type { FoodItem } from "../app/foodBankTypes";
import { uid } from "../app/storage";
import { GradientButton, OutlineButton, StatusMessage, TextArea, TextInput } from "../app/ui";
import { MealPlanDisplay } from "./MealPlanDisplay";
import "../foodbank.css";

type TrainerMealPlanEditorProps = {
  memberId: string;
  memberName: string;
  trainerOwnerUserId?: string;
  foodItems: FoodItem[];
};

type FoodPickerState = {
  dayId: string;
  mealId: string;
} | null;

export function TrainerMealPlanEditor({
  memberId,
  memberName,
  trainerOwnerUserId,
  foodItems,
}: TrainerMealPlanEditorProps) {
  const [plan, setPlan] = useState<MealPlan | null>(null);
  const [activeDayId, setActiveDayId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [foodPicker, setFoodPicker] = useState<FoodPickerState>(null);
  const [foodSearch, setFoodSearch] = useState("");
  const [foodGrams, setFoodGrams] = useState("100");

  const reload = useCallback(async () => {
    if (!memberId.trim()) return;
    setLoading(true);
    const result = await syncMealPlanForMember(memberId, trainerOwnerUserId ?? "");
    setPlan(result.plan);
    setActiveDayId((prev) => prev || result.plan.days[0]?.id || "");
    setLoading(false);
  }, [memberId, trainerOwnerUserId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    const handler = () => void reload();
    window.addEventListener(MEAL_PLAN_CHANGED_EVENT, handler);
    return () => window.removeEventListener(MEAL_PLAN_CHANGED_EVENT, handler);
  }, [reload]);

  const activeDay = useMemo(
    () => plan?.days.find((day) => day.id === activeDayId) ?? plan?.days[0] ?? null,
    [plan, activeDayId],
  );

  const filteredFoods = useMemo(() => {
    const q = foodSearch.trim().toLowerCase();
    let list = foodItems;
    if (q) list = list.filter((item) => item.name.toLowerCase().includes(q));
    return list.slice(0, 40);
  }, [foodItems, foodSearch]);

  function updatePlan(next: MealPlan) {
    setPlan(next);
    persistMealPlanLocalAndScheduleCloud(trainerOwnerUserId, next);
  }

  async function handleSave() {
    if (!plan) return;
    setSaveStatus("Lagrer matplan …");
    const result = await persistMealPlanBundle(trainerOwnerUserId, plan);
    if (result.cloudSynced) {
      setSaveStatus(`Matplan lagret for ${memberName}.`);
    } else {
      setSaveStatus(result.warning ?? "Lagret lokalt.");
    }
  }

  function updateTargets(field: keyof MealPlanTargets, value: string) {
    if (!plan) return;
    const parsed = Number(value.replace(",", "."));
    const nextTargets: MealPlanTargets = { ...(plan.targets ?? {}) };
    if (!value.trim() || !Number.isFinite(parsed)) {
      delete nextTargets[field];
    } else {
      nextTargets[field] = parsed;
    }
    updatePlan({ ...plan, targets: Object.keys(nextTargets).length ? nextTargets : undefined });
  }

  function addFoodToMeal(food: FoodItem) {
    if (!plan || !foodPicker) return;
    const grams = Number(foodGrams.replace(",", "."));
    const safeGrams = Number.isFinite(grams) && grams > 0 ? Math.round(grams) : food.portionGrams || 100;
    const entry: MealPlanFoodEntry = {
      id: uid("meal-food"),
      foodId: food.id,
      foodName: food.name,
      grams: safeGrams,
      nutritionPer100g: { ...food.nutritionPer100g },
    };
    const nextDays = plan.days.map((day) => {
      if (day.id !== foodPicker.dayId) return day;
      return {
        ...day,
        meals: day.meals.map((meal) =>
          meal.id === foodPicker.mealId ? { ...meal, items: [...meal.items, entry] } : meal,
        ),
      };
    });
    updatePlan({ ...plan, days: nextDays });
    setFoodPicker(null);
    setFoodSearch("");
    setFoodGrams(String(food.portionGrams || 100));
  }

  function removeFoodEntry(dayId: string, mealId: string, entryId: string) {
    if (!plan) return;
    updatePlan({
      ...plan,
      days: plan.days.map((day) => {
        if (day.id !== dayId) return day;
        return {
          ...day,
          meals: day.meals.map((meal) =>
            meal.id === mealId ? { ...meal, items: meal.items.filter((item) => item.id !== entryId) } : meal,
          ),
        };
      }),
    });
  }

  function addMealToActiveDay() {
    if (!plan || !activeDay) return;
    const meal: MealPlanMeal = { id: uid("meal"), name: "Nytt måltid", items: [] };
    updatePlan({
      ...plan,
      days: plan.days.map((day) => (day.id === activeDay.id ? { ...day, meals: [...day.meals, meal] } : day)),
    });
  }

  if (loading || !plan) {
    return <div className="rounded-xl border bg-slate-50 px-4 py-6 text-sm text-slate-600">Laster matplan …</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Matplan · {memberName}</h2>
          <p className="text-sm text-slate-600">Bygg ukens måltider fra matvarebanken. Medlem ser planen i appen.</p>
        </div>
        <GradientButton onClick={() => void handleSave()} className="shrink-0">
          <Save className="h-4 w-4" aria-hidden />
          Lagre matplan
        </GradientButton>
      </div>

      {saveStatus ? (
        <StatusMessage
          message={saveStatus}
          tone={saveStatus.toLowerCase().includes("lagret") ? "success" : "error"}
          className="!rounded-xl !px-3 !py-2 !text-xs"
        />
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-xs font-medium text-slate-700">
          <span>Planens navn</span>
          <TextInput value={plan.title} onChange={(e) => updatePlan({ ...plan, title: e.target.value })} />
        </label>
        <label className="space-y-1 text-xs font-medium text-slate-700 sm:col-span-2">
          <span>Notater til medlem</span>
          <TextArea
            value={plan.notes}
            onChange={(e) => updatePlan({ ...plan, notes: e.target.value })}
            className="min-h-[72px]"
            placeholder="Valgfrie instruksjoner …"
          />
        </label>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div className="text-xs font-medium text-slate-700">Daglige makromål (valgfritt)</div>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(
            [
              ["kcal", "Kalorier"],
              ["protein", "Protein (g)"],
              ["carbs", "Karbohydrater (g)"],
              ["fat", "Fett (g)"],
            ] as const
          ).map(([field, label]) => (
            <label key={field} className="space-y-1 text-[11px] font-medium text-slate-600">
              <span>{label}</span>
              <TextInput
                value={plan.targets?.[field] !== undefined ? String(plan.targets[field]) : ""}
                onChange={(e) => updateTargets(field, e.target.value)}
                inputMode="decimal"
              />
            </label>
          ))}
        </div>
      </div>

      <div className="motus-mealplan-day-tabs scrollbar-none flex gap-2 overflow-x-auto pb-1">
        {plan.days.map((day) => {
          const active = day.id === activeDayId;
          return (
            <button
              key={day.id}
              type="button"
              onClick={() => setActiveDayId(day.id)}
              className={`shrink-0 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                active ? "border-teal-300 bg-teal-50 text-teal-900" : "border-slate-200 bg-white text-slate-700"
              }`}
            >
              {day.label}
            </button>
          );
        })}
      </div>

      {activeDay ? (
        <div className="space-y-3">
          {activeDay.meals.map((meal) => (
            <div key={meal.id} className="rounded-xl border bg-white p-3" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <TextInput
                  value={meal.name}
                  onChange={(e) =>
                    updatePlan({
                      ...plan,
                      days: plan.days.map((day) =>
                        day.id === activeDay.id
                          ? {
                              ...day,
                              meals: day.meals.map((row) =>
                                row.id === meal.id ? { ...row, name: e.target.value } : row,
                              ),
                            }
                          : day,
                      ),
                    })
                  }
                  className="max-w-[12rem] font-semibold"
                />
                <span className="text-[11px] font-medium text-slate-500">{formatMacroTotals(computeMealMacros(meal))}</span>
              </div>
              <ul className="mt-2 space-y-2">
                {meal.items.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50 px-2 py-1.5 text-sm"
                  >
                    <span>
                      <span className="font-medium text-slate-800">{item.foodName}</span>
                      <span className="text-slate-500"> · {item.grams} g</span>
                    </span>
                    <button
                      type="button"
                      className="rounded-lg p-1 text-slate-400 hover:bg-white hover:text-red-600"
                      aria-label={`Fjern ${item.foodName}`}
                      onClick={() => removeFoodEntry(activeDay.id, meal.id, item.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
              <OutlineButton
                className="mt-2 w-full sm:w-auto"
                onClick={() => {
                  setFoodPicker({ dayId: activeDay.id, mealId: meal.id });
                  setFoodSearch("");
                }}
              >
                <Plus className="h-4 w-4" aria-hidden />
                Legg til matvare
              </OutlineButton>
            </div>
          ))}
          <OutlineButton onClick={addMealToActiveDay}>
            <Plus className="h-4 w-4" aria-hidden />
            Legg til måltid
          </OutlineButton>
        </div>
      ) : null}

      <details className="rounded-xl border border-slate-200 bg-slate-50/50 p-3">
        <summary className="cursor-pointer text-sm font-semibold text-slate-800">Forhåndsvisning (som medlem)</summary>
        <div className="mt-3">
          <MealPlanDisplay plan={plan} activeDayId={activeDayId} onActiveDayIdChange={setActiveDayId} readOnly />
        </div>
      </details>

      {foodPicker ? (
        <div className="motus-foodbank-modal-backdrop" role="presentation" onClick={() => setFoodPicker(null)}>
          <div
            className="motus-foodbank-modal motus-foodbank-modal--wide"
            role="dialog"
            aria-label="Velg matvare"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="motus-foodbank-modal-head">
              <h3>Velg matvare</h3>
              <button type="button" className="motus-foodbank-icon-btn" onClick={() => setFoodPicker(null)} aria-label="Lukk">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="motus-foodbank-modal-body space-y-3">
              <label className="motus-foodbank-search">
                <Search className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                <input
                  value={foodSearch}
                  onChange={(e) => setFoodSearch(e.target.value)}
                  placeholder="Søk i matvarebank …"
                  aria-label="Søk matvare"
                />
              </label>
              <label className="space-y-1 text-xs font-medium text-slate-700">
                <span>Gram</span>
                <TextInput value={foodGrams} onChange={(e) => setFoodGrams(e.target.value)} inputMode="decimal" />
              </label>
              <div className="max-h-[40vh] space-y-1 overflow-y-auto">
                {filteredFoods.length === 0 ? (
                  <p className="text-sm text-slate-500">Ingen matvarer funnet. Utvid matvarebanken først.</p>
                ) : (
                  filteredFoods.map((food) => (
                    <button
                      key={food.id}
                      type="button"
                      className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-100 px-3 py-2 text-left text-sm hover:bg-teal-50"
                      onClick={() => addFoodToMeal(food)}
                    >
                      <span className="font-medium text-slate-800">{food.name}</span>
                      <span className="text-xs text-slate-500">{food.portionLabel}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
