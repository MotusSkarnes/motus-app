import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronRight,
  Clock,
  Dumbbell,
  Droplets,
  Flame,
  MoreHorizontal,
  Play,
  Plus,
  Share2,
  ShoppingCart,
  Sparkles,
  UtensilsCrossed,
  Wheat,
  X,
} from "lucide-react";
import { MOTUS } from "../../app/data";
import { formatMacro } from "../../app/foodBankTypes";
import type { FoodItem } from "../../app/foodBankTypes";
import { countMealPlanFoodItems } from "../../app/mealPlanCloud";
import {
  computeMealMacros,
  sumLoggedMacrosFromFoodItems,
  type MacroTotals,
} from "../../app/mealPlanMacros";
import { MealPlanDisplay } from "../MealPlanDisplay";
import { buildWeeklyShoppingList } from "../../app/mealPlanShoppingList";
import { useInspirationRecipeItems } from "../../app/inspirationRecipeItems";
import {
  MEAL_PLAN_STATE_CHANGED_EVENT,
  mealSwapKey,
  resolveMealWithSwaps,
  saveMemberMealPlanState,
  setMealSwap,
  type MemberMealPlanState,
} from "../../app/memberMealPlanState";
import {
  persistMemberMealPlanStateLocalAndScheduleCloud,
  scheduleMemberMealPlanStateCloudSave,
  syncMemberMealPlanState,
} from "../../app/memberMealPlanStateCloud";
import {
  computeNutritionStreak,
  getWeekdayIndex,
  loadMealPlanTracking,
  prepareMealPlanTracking,
  removeFoodLogged,
  setWaterLiters,
  toggleFoodLogged,
  toggleMealLogged,
  setRecipePortionMultiplier,
  toggleShoppingChecked,
  toIsoDateKey,
  weekdayShortLabel,
} from "../../app/memberMealPlanTracking";
import type { MealPlan, MealPlanDay, MealPlanMeal, MealPlanTargets } from "../../app/mealPlanTypes";
import { useFoodBankItems } from "../../app/useFoodBankItems";
import { Card } from "../../app/ui";
import { MotusFlameIcon } from "../MotusFlameIcon";
import { MacroProgressBar } from "./MacroProgressBar";
import { MacroProgressRing } from "./MacroProgressRing";
import "../../foodbank.css";

const WATER_TARGET_L = 2.5;
const WATER_STEP_L = 0.2;

type MemberMealPlanDashboardProps = {
  plan: MealPlan;
  memberId: string;
  memberName: string;
  onOpenAvoidances?: () => void;
};

function mealSlotLabel(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("frokost")) return "FROKOST";
  if (n.includes("lunsj")) return "LUNSJ";
  if (n.includes("middag")) return "MIDDAG";
  if (n.includes("snack") || n.includes("mellom")) return "SNACKS";
  return name.toUpperCase();
}

function mealPrepMeta(itemCount: number): { minutes: number; difficulty: string } {
  if (itemCount <= 1) return { minutes: 10, difficulty: "Enkelt" };
  if (itemCount <= 3) return { minutes: 15, difficulty: "Enkelt" };
  return { minutes: 20, difficulty: "Middels" };
}

function mealDisplayTitle(meal: MealPlanMeal): string {
  if (meal.items.length === 0) return meal.name;
  if (meal.items.length === 1) return meal.items[0].foodName;
  return `${meal.items[0].foodName} m.m.`;
}

function mealMacroLine(macros: MacroTotals): string {
  return `${formatMacro(macros.kcal, 0)} kcal · ${formatMacro(macros.protein, 0)}g protein`;
}

function normalizeMealKey(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "");
}

function dateKeyForPlanDayIndex(today: Date, todayWeekdayIndex: number, dayIndex: number): string {
  const d = new Date(today);
  d.setDate(today.getDate() - (todayWeekdayIndex - dayIndex));
  return toIsoDateKey(d);
}

export function MemberMealPlanDashboard({ plan, memberId, onOpenAvoidances }: MemberMealPlanDashboardProps) {
  const foodItems = useFoodBankItems();
  const { items: inspirationRecipes } = useInspirationRecipeItems();
  const foodById = useMemo(() => new Map(foodItems.map((f) => [f.id, f])), [foodItems]);
  const recipesById = useMemo(
    () => new Map(inspirationRecipes.map((recipe) => [recipe.id, recipe])),
    [inspirationRecipes],
  );

  const today = useMemo(() => new Date(), []);
  const todayKey = toIsoDateKey(today);
  const todayWeekdayIndex = getWeekdayIndex(today);
  const todayDay = plan.days[todayWeekdayIndex] ?? plan.days[0];

  const [selectedDayIndex, setSelectedDayIndex] = useState(todayWeekdayIndex);
  const [showFullWeekView, setShowFullWeekView] = useState(false);
  const [fullWeekDayId, setFullWeekDayId] = useState(plan.days[todayWeekdayIndex]?.id ?? plan.days[0]?.id ?? "");
  const [tracking, setTracking] = useState<MemberMealPlanState>(() => loadMealPlanTracking(memberId));
  const [swapMeal, setSwapMeal] = useState<MealPlanMeal | null>(null);
  const [showShopping, setShowShopping] = useState(false);
  const [showCoachTips, setShowCoachTips] = useState(false);
  const [expandedMealId, setExpandedMealId] = useState<string | null>(null);
  const [mealMenuId, setMealMenuId] = useState<string | null>(null);

  const totalFoodInPlan = useMemo(() => countMealPlanFoodItems(plan), [plan]);

  useEffect(() => {
    const todayHasFood = todayDay.meals.some((meal) => meal.items.length > 0);
    if (todayHasFood) {
      setSelectedDayIndex(todayWeekdayIndex);
      return;
    }
    const firstWithFood = plan.days.findIndex((day) => day.meals.some((meal) => meal.items.length > 0));
    setSelectedDayIndex(firstWithFood >= 0 ? firstWithFood : todayWeekdayIndex);
  }, [plan.id, plan.updatedAt, todayDay.meals, todayWeekdayIndex]);

  const selectedDay = plan.days[selectedDayIndex] ?? plan.days[0];
  const selectedDateKey = dateKeyForPlanDayIndex(today, todayWeekdayIndex, selectedDayIndex);
  const isSelectedToday = selectedDayIndex === todayWeekdayIndex;

  const refreshState = useCallback(async () => {
    if (!memberId.trim()) return;
    const localBefore = loadMealPlanTracking(memberId);
    const synced = await syncMemberMealPlanState(memberId);
    const localAfter = loadMealPlanTracking(memberId);
    const beforeMs = Date.parse(localBefore.updatedAt ?? "") || 0;
    const afterMs = Date.parse(localAfter.updatedAt ?? "") || 0;
    const syncedMs = Date.parse(synced.updatedAt ?? "") || 0;
    if (afterMs > syncedMs && afterMs >= beforeMs) {
      setTracking(localAfter);
      return;
    }
    setTracking(synced);
  }, [memberId]);

  useEffect(() => {
    void refreshState();
  }, [refreshState]);

  useEffect(() => {
    const handler = () => void refreshState();
    window.addEventListener(MEAL_PLAN_STATE_CHANGED_EVENT, handler);
    return () => window.removeEventListener(MEAL_PLAN_STATE_CHANGED_EVENT, handler);
  }, [refreshState]);

  const targets: MealPlanTargets = plan.targets ?? {};
  const targetKcal = targets.kcal ?? 1900;
  const targetProtein = targets.protein ?? 140;
  const targetCarbs = targets.carbs ?? 200;
  const targetFat = targets.fat ?? 65;

  const todayMealsResolved = useMemo(
    () =>
      todayDay.meals.map((meal) => resolveMealWithSwaps(plan, meal, todayKey, tracking.mealSwaps)),
    [plan, todayDay.meals, todayKey, tracking.mealSwaps],
  );
  const todayDayResolved = useMemo(
    () => ({ ...todayDay, meals: todayMealsResolved }),
    [todayDay, todayMealsResolved],
  );

  const selectedMealsResolved = useMemo(
    () =>
      (selectedDay?.meals ?? []).map((meal) =>
        resolveMealWithSwaps(plan, meal, selectedDateKey, tracking.mealSwaps),
      ),
    [plan, selectedDay?.meals, selectedDateKey, tracking.mealSwaps],
  );
  const selectedDayResolved = useMemo(
    () => (selectedDay ? { ...selectedDay, meals: selectedMealsResolved } : null),
    [selectedDay, selectedMealsResolved],
  );

  const loggedFoodToday = useMemo(
    () => new Set(tracking.loggedFoodIds[todayKey] ?? []),
    [tracking.loggedFoodIds, todayKey],
  );
  const loggedFoodSelected = useMemo(
    () => new Set(tracking.loggedFoodIds[selectedDateKey] ?? []),
    [tracking.loggedFoodIds, selectedDateKey],
  );
  const loggedMacrosToday = useMemo(
    () => sumLoggedMacrosFromFoodItems(todayDayResolved, loggedFoodToday, foodById),
    [todayDayResolved, loggedFoodToday, foodById],
  );
  const loggedMacrosSelected = useMemo(() => {
    if (!selectedDayResolved) return loggedMacrosToday;
    return sumLoggedMacrosFromFoodItems(selectedDayResolved, loggedFoodSelected, foodById);
  }, [selectedDayResolved, loggedFoodSelected, foodById, loggedMacrosToday]);
  const selectedDayFoodCount = selectedMealsResolved.filter((meal) => meal.items.length > 0).length;

  const displayMacrosToday = loggedMacrosToday;
  const displayMacrosProgress = isSelectedToday ? loggedMacrosToday : loggedMacrosSelected;
  const waterLiters = tracking.waterLiters[todayKey] ?? 0;
  const kcalRemaining = Math.max(0, Math.round(targetKcal - displayMacrosToday.kcal));
  const streakDays = computeNutritionStreak(tracking.loggedMeals, tracking.loggedFoodIds);
  const todayMealsWithFood = useMemo(
    () => todayMealsResolved.filter((meal) => meal.items.length > 0),
    [todayMealsResolved],
  );
  const mealsCompletedCount = useMemo(
    () =>
      todayMealsWithFood.filter((meal) =>
        meal.items.every((item) => loggedFoodToday.has(item.id)),
      ).length,
    [todayMealsWithFood, loggedFoodToday],
  );
  const mealsTotalCount = todayMealsWithFood.length;
  const mealsProgressPct = mealsTotalCount > 0 ? (mealsCompletedCount / mealsTotalCount) * 100 : 0;

  const weekProgress = useMemo(() => {
    let logged = 0;
    let planned = 0;
    for (let i = 0; i < 7; i += 1) {
      const d = new Date(today);
      d.setDate(today.getDate() - (todayWeekdayIndex - i));
      const key = toIsoDateKey(d);
      const day = plan.days[i];
      const loggedFood = new Set(tracking.loggedFoodIds[key] ?? []);
      for (const meal of day?.meals ?? []) {
        for (const item of meal.items) {
          planned += 1;
          if (loggedFood.has(item.id)) logged += 1;
        }
      }
    }
    return { logged, planned };
  }, [plan.days, today, todayWeekdayIndex, tracking.loggedFoodIds]);

  const weekStatusLine =
    weekProgress.planned > 0 && weekProgress.logged >= weekProgress.planned * 0.6
      ? "Du ligger foran ukesmålet ditt"
      : weekProgress.logged > 0
        ? "God fremgang denne uken"
        : "Logg måltider for å følge planen";

  const shoppingList = useMemo(
    () =>
      buildWeeklyShoppingList({
        plan,
        foodById,
        foodItems,
        recipesById,
        recipePortions: tracking.recipePortions,
      }),
    [plan, foodById, foodItems, recipesById, tracking.recipePortions],
  );
  const shoppingGroups = shoppingList.groups;

  const handleRecipePortionChange = useCallback(
    (entryId: string, next: number) => {
      setTracking((prev) => setRecipePortionMultiplier(memberId, prev, entryId, next));
    },
    [memberId],
  );

  const swapAlternatives = useMemo(() => {
    if (!swapMeal) return [];
    const key = normalizeMealKey(swapMeal.name);
    const rows: { meal: MealPlanMeal; dayId: string; dayLabel: string }[] = [];
    for (const day of plan.days) {
      for (const meal of day.meals) {
        if (meal.id === swapMeal.id || meal.items.length === 0) continue;
        if (normalizeMealKey(meal.name) === key) {
          rows.push({ meal, dayId: day.id, dayLabel: day.label });
        }
      }
    }
    return rows.slice(0, 6);
  }, [plan.days, swapMeal]);

  const handleApplySwap = useCallback(
    (sourceDayId: string, sourceMealId: string) => {
      if (!swapMeal) return;
      const next = setMealSwap(tracking, selectedDateKey, swapMeal.id, sourceDayId, sourceMealId);
      setTracking(next);
      persistMemberMealPlanStateLocalAndScheduleCloud(memberId, next);
      setSwapMeal(null);
    },
    [memberId, selectedDateKey, swapMeal, tracking],
  );

  const coachTips = useMemo(() => {
    const tips: string[] = [];
    if (plan.notes.trim()) tips.push(plan.notes.trim());
    tips.push("Få i deg 20–40 g protein i hvert måltid for jevn energi gjennom dagen.");
    tips.push("Prioriter protein tidlig på dagen — det gjør resten av dagen enklere.");
    if (targetProtein > 0 && displayMacrosToday.protein < targetProtein * 0.5) {
      tips.push(`Du har ${formatMacro(targetProtein - displayMacrosToday.protein, 0)} g protein igjen i dag.`);
    }
    return tips;
  }, [displayMacrosToday.protein, plan.notes, targetProtein]);

  useEffect(() => {
    if (!memberId.trim()) return;
    setTracking((prev) => {
      let next = prepareMealPlanTracking(prev, todayKey, todayMealsResolved);
      next = prepareMealPlanTracking(next, selectedDateKey, selectedMealsResolved);
      if (next === prev) return prev;
      saveMemberMealPlanState(memberId, next, { notify: false });
      scheduleMemberMealPlanStateCloudSave(memberId, next);
      return next;
    });
  }, [memberId, todayKey, selectedDateKey, todayMealsResolved, selectedMealsResolved]);

  const handleToggleMeal = useCallback(
    (meal: MealPlanMeal) => {
      setTracking((prev) =>
        toggleMealLogged(memberId, prev, selectedDateKey, meal.id, meal, selectedMealsResolved),
      );
    },
    [memberId, selectedDateKey, selectedMealsResolved],
  );

  const handleToggleFood = useCallback(
    (foodEntryId: string) => {
      setTracking((prev) =>
        toggleFoodLogged(memberId, prev, selectedDateKey, selectedMealsResolved, foodEntryId),
      );
    },
    [memberId, selectedDateKey, selectedMealsResolved],
  );

  const handleRemoveFood = useCallback(
    (foodEntryId: string) => {
      setTracking((prev) =>
        removeFoodLogged(memberId, prev, selectedDateKey, selectedMealsResolved, foodEntryId),
      );
    },
    [memberId, selectedDateKey, selectedMealsResolved],
  );

  const handleWaterAdjust = useCallback(
    (delta: number) => {
      const next = Math.min(WATER_TARGET_L * 1.5, Math.max(0, waterLiters + delta));
      setTracking((prev) => setWaterLiters(memberId, prev, todayKey, Math.round(next * 10) / 10));
    },
    [memberId, todayKey, waterLiters],
  );

  const resolveMealImage = (meal: MealPlanMeal): string | null => {
    for (const item of meal.items) {
      if (item.imageUrl?.trim()) return item.imageUrl.trim();
      const food = foodById.get(item.foodId);
      if (food?.imageUrl) return food.imageUrl;
    }
    return null;
  };

  const displayMeals = isSelectedToday ? todayMealsResolved : selectedMealsResolved;
  const displayLoggedFood = isSelectedToday ? loggedFoodToday : loggedFoodSelected;
  const displayMacros = isSelectedToday ? displayMacrosToday : displayMacrosProgress;

  const handleShareDay = useCallback(async () => {
    const summary = `${isSelectedToday ? "I dag" : selectedDay?.label ?? "Dagen"}: ${mealsCompletedCount}/${mealsTotalCount || 0} måltider logget · ${formatMacro(displayMacrosToday.kcal, 0)} kcal · ${formatMacro(displayMacrosToday.protein, 0)} g protein`;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "Motus matplan", text: summary });
        return;
      } catch {
        /* user cancelled */
      }
    }
    if (typeof navigator.clipboard?.writeText === "function") {
      await navigator.clipboard.writeText(summary);
    }
  }, [
    displayMacrosToday.kcal,
    displayMacrosToday.protein,
    isSelectedToday,
    mealsCompletedCount,
    mealsTotalCount,
    selectedDay?.label,
  ]);

  return (
    <div className="motus-matplan motus-matplan--v2 motus-fade-in-up">
      <div className="motus-matplan-progress-head" aria-label="Måltidsfremdrift i dag">
        <div className="motus-matplan-progress-head__row">
          <p className="motus-matplan-progress-head__title">
            {mealsCompletedCount}/{mealsTotalCount || 0} måltider fullført
          </p>
          {streakDays > 0 ? (
            <span className="motus-matplan-progress-head__streak" aria-label={`${streakDays} dager på rad`}>
              <MotusFlameIcon className="h-4 w-4" />
              {streakDays}
            </span>
          ) : null}
        </div>
        <div className="motus-matplan-progress-bar" aria-hidden>
          <div className="motus-matplan-progress-bar__fill" style={{ width: `${mealsProgressPct}%` }} />
        </div>
        <p className="motus-matplan-progress-head__hint">{weekStatusLine}</p>
      </div>

      <section className="motus-matplan-progress-card" aria-label="Dagens fremdrift">
        <h2 className="motus-matplan-progress-card__title">Dagens fremdrift</h2>
        <div className="motus-matplan-progress-card__body">
          <MacroProgressRing
            label="Kalorier"
            current={displayMacros.kcal}
            target={targetKcal}
            unit="kcal"
            size="xl"
            hideLabel
            sublabel={kcalRemaining > 0 ? `${kcalRemaining} igjen` : null}
          />
          <div className="motus-matplan-progress-card__macros">
            <MacroProgressBar
              label="Protein"
              current={displayMacros.protein}
              target={targetProtein}
              icon={<Dumbbell className="h-4 w-4" aria-hidden />}
            />
            <MacroProgressBar
              label="Karbohydrater"
              current={displayMacros.carbs}
              target={targetCarbs}
              icon={<Wheat className="h-4 w-4" aria-hidden />}
            />
            <MacroProgressBar
              label="Fett"
              current={displayMacros.fat}
              target={targetFat}
              icon={<Droplets className="h-4 w-4" aria-hidden />}
            />
          </div>
        </div>
        <button
          type="button"
          className="motus-matplan-water-chip motus-pressable"
          onClick={() => handleWaterAdjust(WATER_STEP_L)}
          aria-label={`Vann ${waterLiters} av ${WATER_TARGET_L} liter, trykk for å legge til`}
        >
          <Droplets className="h-3.5 w-3.5" aria-hidden />
          Vann {waterLiters.toFixed(1)} / {WATER_TARGET_L} L
        </button>
      </section>

      <section className="motus-matplan-section" aria-label="Måltider">
        <div className="motus-matplan-section-head">
          <h2 className="motus-matplan-section-title">
            {isSelectedToday ? "Dagens måltider" : `Måltider — ${selectedDay?.label ?? ""}`}
          </h2>
          <button
            type="button"
            className="motus-matplan-link-btn"
            onClick={() => setShowFullWeekView((v) => !v)}
          >
            {showFullWeekView ? "Skjul uke" : "Se alle måltider"}
            <ChevronRight className={`h-3.5 w-3.5 ${showFullWeekView ? "rotate-90" : ""}`} aria-hidden />
          </button>
        </div>

        {showFullWeekView ? (
          <>
            <div className="motus-matplan-week-row">
              {plan.days.map((day, index) => {
                const d = new Date(today);
                d.setDate(today.getDate() - (todayWeekdayIndex - index));
                const dateKey = toIsoDateKey(d);
                const loggedFood = new Set(tracking.loggedFoodIds[dateKey] ?? []);
                const mealsWithFood = day.meals.filter((m) => m.items.length > 0);
                const foodItems = mealsWithFood.flatMap((m) => m.items);
                const complete =
                  foodItems.length > 0 && foodItems.every((item) => loggedFood.has(item.id));
                const isToday = index === todayWeekdayIndex;
                const isPast = index < todayWeekdayIndex;
                const hasActivity = loggedFood.size > 0;
                const dayHasFood = mealsWithFood.length > 0;
                const isSelected = index === selectedDayIndex;

                return (
                  <button
                    key={day.id}
                    type="button"
                    className={`motus-matplan-week-day motus-pressable ${isToday ? "motus-matplan-week-day--today" : ""} ${isSelected ? "motus-matplan-week-day--selected" : ""}`}
                    onClick={() => setSelectedDayIndex(index)}
                    aria-label={`Vis matplan for ${day.label}`}
                    aria-pressed={isSelected}
                  >
                    <span className="motus-matplan-week-day-label">{weekdayShortLabel(index)}</span>
                    <div
                      className={`motus-matplan-week-dot ${
                        complete || (isPast && hasActivity)
                          ? "motus-matplan-week-dot--done"
                          : isSelected
                            ? "motus-matplan-week-dot--selected"
                            : isToday
                              ? "motus-matplan-week-dot--today"
                              : dayHasFood
                                ? "motus-matplan-week-dot--planned"
                                : ""
                      }`}
                    >
                      {complete || (isPast && hasActivity) ? (
                        <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} aria-hidden />
                      ) : isToday ? (
                        <Flame className="h-3.5 w-3.5" style={{ color: MOTUS.pink }} aria-hidden />
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="motus-matplan-full-week">
              <MealPlanDisplay
                plan={plan}
                readOnly
                activeDayId={fullWeekDayId}
                onActiveDayIdChange={setFullWeekDayId}
              />
            </div>
          </>
        ) : null}

        {totalFoodInPlan > 0 && selectedDayFoodCount === 0 && !isSelectedToday ? (
          <Card className="border-teal-200 bg-teal-50/80 p-3 text-sm text-teal-900">
            Ingen matvarer på {selectedDay?.label ?? "denne dagen"}. PT har lagt inn mat på andre dager — velg dem i
            ukeoversikten.
          </Card>
        ) : null}

        <div className="motus-matplan-meals motus-matplan-meals--v2">
          {displayMeals.map((meal) => {
            const macros = computeMealMacros(meal, foodById);
            const loggedFoodCount = meal.items.filter((item) => displayLoggedFood.has(item.id)).length;
            const logged = meal.items.length > 0 && loggedFoodCount === meal.items.length;
            const hasPartialLog = loggedFoodCount > 0 && !logged;
            const hasFood = meal.items.length > 0;
            const imageSrc = resolveMealImage(meal);
            const isSwapped = Boolean(tracking.mealSwaps[mealSwapKey(selectedDateKey, meal.id)]);
            const prepMeta = mealPrepMeta(meal.items.length);
            const isExpanded = expandedMealId === meal.id;
            const menuOpen = mealMenuId === meal.id;

            return (
              <article
                key={meal.id}
                className={`motus-matplan-meal-card motus-matplan-meal-card--v2 ${logged ? "motus-matplan-meal-card--logged" : ""} ${hasPartialLog ? "motus-matplan-meal-card--partial" : ""}`}
              >
                <div className="motus-matplan-meal-card__media">
                  {imageSrc ? (
                    <img src={imageSrc} alt="" className="motus-matplan-meal-card__img" loading="lazy" />
                  ) : (
                    <div className="motus-matplan-meal-card__img motus-matplan-meal-card__img--placeholder" aria-hidden>
                      <UtensilsCrossed className="h-7 w-7 text-white/75" strokeWidth={1.5} />
                    </div>
                  )}
                </div>
                <div className="motus-matplan-meal-card__body">
                  <div className="motus-matplan-meal-card__top">
                    <span className="motus-matplan-meal-card__slot">{mealSlotLabel(meal.name)}</span>
                    <div className="relative">
                      <button
                        type="button"
                        className="motus-matplan-meal-card__menu motus-pressable"
                        aria-label={`Meny for ${meal.name}`}
                        aria-expanded={menuOpen}
                        onClick={() => setMealMenuId(menuOpen ? null : meal.id)}
                      >
                        <MoreHorizontal className="h-4 w-4" aria-hidden />
                      </button>
                      {menuOpen ? (
                        <div className="motus-matplan-meal-card__dropdown">
                          {hasFood ? (
                            <>
                              <button type="button" className="motus-pressable" onClick={() => { setSwapMeal(meal); setMealMenuId(null); }}>
                                Bytt måltid
                              </button>
                              <button
                                type="button"
                                className="motus-pressable"
                                onClick={() => {
                                  setExpandedMealId(isExpanded ? null : meal.id);
                                  setMealMenuId(null);
                                }}
                              >
                                {isExpanded ? "Skjul detaljer" : "Vis matvarer"}
                              </button>
                            </>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  {isSwapped ? <span className="motus-matplan-meal-swapped">Byttet måltid</span> : null}
                  <h3 className="motus-matplan-meal-card__title">{hasFood ? mealDisplayTitle(meal) : meal.name}</h3>
                  {hasFood ? (
                    <>
                      <p className="motus-matplan-meal-card__macros">{mealMacroLine(macros)}</p>
                      <div className="motus-matplan-meal-card__meta">
                        <span>
                          <Clock className="h-3.5 w-3.5" aria-hidden />
                          {prepMeta.minutes} min
                        </span>
                        <span>{prepMeta.difficulty}</span>
                      </div>
                    </>
                  ) : (
                    <p className="motus-matplan-meal-card__macros motus-matplan-meal-card__macros--muted">
                      Treneren fyller ut dette måltidet
                    </p>
                  )}
                  {isExpanded && hasFood ? (
                    <ul className="motus-matplan-meal-foods">
                      {meal.items.map((item) => {
                        const foodLogged = displayLoggedFood.has(item.id);
                        return (
                          <li
                            key={item.id}
                            className={`motus-matplan-meal-food ${foodLogged ? "motus-matplan-meal-food--logged" : ""}`}
                          >
                            <div className="motus-matplan-meal-food-main">
                              <span className="motus-matplan-meal-food-name">{item.foodName}</span>
                              <span className="motus-matplan-meal-food-grams">{item.grams} g</span>
                            </div>
                            <div className="motus-matplan-meal-food-actions">
                              {foodLogged ? (
                                <button
                                  type="button"
                                  className="motus-matplan-food-remove motus-pressable"
                                  onClick={() => handleRemoveFood(item.id)}
                                  aria-label={`Fjern ${item.foodName} fra logg`}
                                >
                                  <X className="h-3.5 w-3.5" aria-hidden />
                                  Fjern
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="motus-matplan-food-log motus-pressable"
                                  onClick={() => handleToggleFood(item.id)}
                                  aria-label={`Logg ${item.foodName}`}
                                >
                                  <Plus className="h-3.5 w-3.5" aria-hidden />
                                  Logg
                                </button>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </div>
                <button
                  type="button"
                  className={`motus-matplan-meal-card__check motus-pressable ${logged ? "motus-matplan-meal-card__check--done" : ""}`}
                  onClick={() => hasFood && handleToggleMeal(meal)}
                  disabled={!hasFood}
                  aria-label={logged ? `Fjern ${meal.name} fra logg` : `Logg ${meal.name}`}
                >
                  {logged ? <Check className="h-4 w-4" strokeWidth={3} aria-hidden /> : null}
                </button>
              </article>
            );
          })}
        </div>
      </section>

      <div className="motus-matplan-footer">
        <div className="motus-matplan-footer__secondary">
          <button
            type="button"
            className="motus-matplan-footer__chip motus-pressable"
            onClick={() => onOpenAvoidances?.()}
          >
            Rediger
          </button>
          <button type="button" className="motus-matplan-footer__chip motus-pressable" onClick={() => void handleShareDay()}>
            <Share2 className="h-3.5 w-3.5" aria-hidden />
            Del
          </button>
        </div>
        <button type="button" className="motus-matplan-footer__ai motus-pressable" disabled aria-disabled="true">
          <Sparkles className="h-4 w-4" aria-hidden />
          AI-generer dagens matplan
          <span className="motus-matplan-footer__ai-badge">Kommer snart</span>
        </button>
      </div>

      {/* Coach */}
      {plan.notes.trim() || coachTips.length > 0 ? (
        <section className="motus-matplan-section" aria-label="Coach">
          <h2 className="motus-matplan-section-title">Coach</h2>
          <div className="motus-matplan-coach-card">
            <div className="motus-matplan-coach-avatar" aria-hidden>
              <span>PT</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="motus-matplan-coach-label">Coachens fokus denne uken</p>
              <p className="motus-matplan-coach-quote">
                {plan.notes.trim()
                  ? `"${plan.notes.trim()}"`
                  : `"${coachTips[0]}"`}
              </p>
            </div>
            <button
              type="button"
              className="motus-matplan-coach-play motus-pressable"
              aria-label="Se coachens tips"
              onClick={() => setShowCoachTips(true)}
            >
              <Play className="h-4 w-4 fill-current" aria-hidden />
            </button>
          </div>
        </section>
      ) : null}

      {/* Handleliste */}
      {shoppingGroups.length > 0 || shoppingList.recipeControls.length > 0 ? (
        <section className="motus-matplan-section" aria-label="Ukens handleliste">
          <button
            type="button"
            className="motus-matplan-shopping-toggle motus-pressable"
            onClick={() => setShowShopping((v) => !v)}
          >
            <ShoppingCart className="h-4 w-4" style={{ color: MOTUS.turquoise }} aria-hidden />
            <span className="motus-matplan-section-title mb-0">Ukens handleliste</span>
            <ChevronRight
              className={`ml-auto h-4 w-4 transition ${showShopping ? "rotate-90" : ""}`}
              aria-hidden
            />
          </button>
          {showShopping ? (
            <div className="motus-matplan-shopping">
              {shoppingList.warnings.length > 0 ? (
                <Card className="border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
                  {shoppingList.warnings.map((warning) => (
                    <p key={warning} className="mt-1 first:mt-0">
                      {warning}
                    </p>
                  ))}
                </Card>
              ) : null}
              {shoppingList.recipeControls.length > 0 ? (
                <div className="motus-matplan-shopping-portions">
                  <h3 className="motus-matplan-shopping-group-title">Porsjoner (familie / ekstra)</h3>
                  <p className="motus-matplan-shopping-portions-hint">
                    Juster hvor mange ganger du skal lage hver oppskrift — ingrediensene oppdateres under.
                  </p>
                  <ul className="motus-matplan-shopping-portions-list">
                    {shoppingList.recipeControls.map((row) => {
                      const portionValue = tracking.recipePortions[row.entryId] ?? row.portionMultiplier;
                      return (
                      <li key={`${row.entryId}-${row.dayLabel}`} className="motus-matplan-shopping-portion-row">
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-sm text-slate-900">{row.title}</div>
                          <div className="text-xs text-slate-500">
                            {row.dayLabel} · {row.mealName}
                          </div>
                        </div>
                        <div className="motus-matplan-shopping-portion-stepper" role="group" aria-label={`Porsjoner for ${row.title}`}>
                          <button
                            type="button"
                            className="motus-matplan-shopping-portion-btn motus-pressable"
                            onClick={() => handleRecipePortionChange(row.entryId, portionValue - 0.5)}
                            aria-label="Færre porsjoner"
                          >
                            −
                          </button>
                          <span className="motus-matplan-shopping-portion-value">
                            {portionValue.toString().replace(".", ",")}×
                          </span>
                          <button
                            type="button"
                            className="motus-matplan-shopping-portion-btn motus-pressable"
                            onClick={() => handleRecipePortionChange(row.entryId, portionValue + 0.5)}
                            aria-label="Flere porsjoner"
                          >
                            +
                          </button>
                        </div>
                      </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}
              {shoppingGroups.length > 0 ? (
                shoppingGroups.map((group) => (
                  <div key={group.id} className="motus-matplan-shopping-group">
                    <h3 className="motus-matplan-shopping-group-title">{group.label}</h3>
                    <ul className="motus-matplan-shopping-list">
                      {group.items.map((item) => {
                        const checked = tracking.checkedShopping.includes(item.key);
                        return (
                          <li key={item.key}>
                            <button
                              type="button"
                              className={`motus-matplan-shopping-item motus-pressable ${checked ? "motus-matplan-shopping-item--checked" : ""}`}
                              onClick={() =>
                                setTracking((prev) => toggleShoppingChecked(memberId, prev, item.key))
                              }
                            >
                              <span className={`motus-matplan-shopping-check ${checked ? "motus-matplan-shopping-check--on" : ""}`}>
                                {checked ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
                              </span>
                              <span className={checked ? "line-through opacity-60" : ""}>{item.displayLabel}</span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-600">
                  Ingen ingredienser kunne beregnes ennå. Sjekk at oppskriftene har en ingrediensliste under Ernæring.
                </p>
              )}
            </div>
          ) : null}
        </section>
      ) : null}

      {/* Swap modal */}
      {swapMeal ? (
        <div className="motus-foodbank-modal-backdrop" role="presentation" onClick={() => setSwapMeal(null)}>
          <div
            className="motus-foodbank-modal motus-matplan-swap-modal"
            role="dialog"
            aria-labelledby="swap-meal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="motus-foodbank-modal-head">
              <h2 id="swap-meal-title" className="text-base font-bold text-slate-900">
                Bytt måltid
              </h2>
              <button type="button" className="motus-foodbank-icon-btn" onClick={() => setSwapMeal(null)} aria-label="Lukk">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="motus-foodbank-modal-body space-y-3">
              <p className="text-sm text-slate-600">
                Nåværende: <strong>{mealDisplayTitle(swapMeal)}</strong>
              </p>
              {swapAlternatives.length > 0 ? (
                <>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Forslag til bytte</p>
                  <ul className="motus-matplan-swap-list">
                    {swapAlternatives.map(({ meal, dayId, dayLabel }) => {
                      const macros = computeMealMacros(meal, foodById);
                      const img = resolveMealImage(meal);
                      return (
                        <li key={`${dayLabel}-${meal.id}`}>
                          <button
                            type="button"
                            className="motus-matplan-swap-item motus-pressable"
                            onClick={() => handleApplySwap(dayId, meal.id)}
                          >
                            {img ? (
                              <img src={img} alt="" className="motus-matplan-swap-thumb" />
                            ) : (
                              <div className="motus-matplan-swap-thumb motus-matplan-swap-thumb--placeholder">
                                <UtensilsCrossed className="h-4 w-4 text-white/80" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1 text-left">
                              <div className="font-semibold text-slate-900">{mealDisplayTitle(meal)}</div>
                              <div className="text-xs text-slate-500">
                                {dayLabel} · {mealMacroLine(macros)}
                              </div>
                            </div>
                            <span className="motus-matplan-swap-add">
                              <Plus className="h-4 w-4" />
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </>
              ) : (
                <p className="text-sm text-slate-600">
                  Ingen andre {swapMeal.name.toLowerCase()}-forslag i planen akkurat nå. Be treneren om flere alternativer.
                </p>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* Coach tips modal */}
      {showCoachTips ? (
        <div className="motus-foodbank-modal-backdrop" role="presentation" onClick={() => setShowCoachTips(false)}>
          <div
            className="motus-foodbank-modal motus-matplan-tips-modal"
            role="dialog"
            aria-labelledby="coach-tips-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="motus-foodbank-modal-head">
              <h2 id="coach-tips-title" className="text-base font-bold text-slate-900">
                Coachens tips
              </h2>
              <button type="button" className="motus-foodbank-icon-btn" onClick={() => setShowCoachTips(false)} aria-label="Lukk">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="motus-foodbank-modal-body space-y-3">
              {coachTips.map((tip, i) => (
                <div key={i} className="motus-matplan-tip-card">
                  <p className="text-sm leading-relaxed text-slate-700">{tip}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
