import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronRight,
  Droplets,
  Flame,
  Play,
  Plus,
  ShoppingCart,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { MOTUS } from "../../app/data";
import { formatMacro } from "../../app/foodBankTypes";
import type { FoodItem } from "../../app/foodBankTypes";
import {
  computeDayMacros,
  computeMealMacros,
  type MacroTotals,
  sumMacroTotals,
} from "../../app/mealPlanMacros";
import { buildWeeklyShoppingList } from "../../app/mealPlanShoppingList";
import {
  MEAL_PLAN_STATE_CHANGED_EVENT,
  mealSwapKey,
  resolveMealWithSwaps,
  setMealSwap,
  type MemberMealPlanState,
} from "../../app/memberMealPlanState";
import {
  persistMemberMealPlanStateLocalAndScheduleCloud,
  syncMemberMealPlanState,
} from "../../app/memberMealPlanStateCloud";
import {
  computeNutritionStreak,
  getTimeBasedGreeting,
  getWeekdayIndex,
  isMealLogged,
  loadMealPlanTracking,
  setWaterLiters,
  toggleMealLogged,
  toggleShoppingChecked,
  toIsoDateKey,
  weekdayShortLabel,
} from "../../app/memberMealPlanTracking";
import type { MealPlan, MealPlanDay, MealPlanMeal, MealPlanTargets } from "../../app/mealPlanTypes";
import { useFoodBankItems } from "../../app/useFoodBankItems";
import { MotusFlameIcon } from "../MotusFlameIcon";
import { MacroProgressRing } from "./MacroProgressRing";
import "../../foodbank.css";

const WATER_TARGET_L = 2.5;
const WATER_STEP_L = 0.2;

type MemberMealPlanDashboardProps = {
  plan: MealPlan;
  memberId: string;
  memberName: string;
};

function mealSlotLabel(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("frokost")) return "FROKOST";
  if (n.includes("lunsj")) return "LUNSJ";
  if (n.includes("middag")) return "MIDDAG";
  if (n.includes("snack") || n.includes("mellom")) return "MELLOMMÅLTID";
  return name.toUpperCase();
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

function sumLoggedMacros(day: MealPlanDay, loggedIds: Set<string>): MacroTotals {
  const rows = day.meals
    .filter((meal) => loggedIds.has(meal.id) && meal.items.length > 0)
    .map((meal) => computeMealMacros(meal));
  return sumMacroTotals(rows);
}

export function MemberMealPlanDashboard({ plan, memberId, memberName }: MemberMealPlanDashboardProps) {
  const foodItems = useFoodBankItems();
  const foodById = useMemo(() => new Map(foodItems.map((f) => [f.id, f])), [foodItems]);

  const today = useMemo(() => new Date(), []);
  const todayKey = toIsoDateKey(today);
  const todayWeekdayIndex = getWeekdayIndex(today);
  const todayDay = plan.days[todayWeekdayIndex] ?? plan.days[0];

  const [tracking, setTracking] = useState<MemberMealPlanState>(() => loadMealPlanTracking(memberId));
  const [swapMeal, setSwapMeal] = useState<MealPlanMeal | null>(null);
  const [showShopping, setShowShopping] = useState(false);
  const [showCoachTips, setShowCoachTips] = useState(false);

  const refreshState = useCallback(async () => {
    if (!memberId.trim()) return;
    const synced = await syncMemberMealPlanState(memberId);
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

  const firstName = memberName.split(/\s+/)[0] || memberName;
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

  const loggedToday = useMemo(() => new Set(tracking.loggedMeals[todayKey] ?? []), [tracking.loggedMeals, todayKey]);
  const loggedMacrosToday = useMemo(() => sumLoggedMacros(todayDayResolved, loggedToday), [todayDayResolved, loggedToday]);
  const plannedMacrosToday = useMemo(() => computeDayMacros(todayDayResolved), [todayDayResolved]);

  const displayMacros = loggedMacrosToday.kcal > 0 ? loggedMacrosToday : plannedMacrosToday;
  const waterLiters = tracking.waterLiters[todayKey] ?? 0;
  const kcalRemaining = Math.max(0, Math.round(targetKcal - displayMacros.kcal));
  const streakDays = computeNutritionStreak(tracking.loggedMeals);

  const weekProgress = useMemo(() => {
    let logged = 0;
    let planned = 0;
    for (let i = 0; i < 7; i += 1) {
      const d = new Date(today);
      d.setDate(today.getDate() - (todayWeekdayIndex - i));
      const key = toIsoDateKey(d);
      const day = plan.days[i];
      const mealsWithFood = day?.meals.filter((m) => m.items.length > 0).length ?? 0;
      planned += mealsWithFood;
      logged += (tracking.loggedMeals[key] ?? []).filter((id) =>
        day?.meals.some((m) => m.id === id && m.items.length > 0),
      ).length;
    }
    return { logged, planned };
  }, [plan.days, today, todayWeekdayIndex, tracking.loggedMeals]);

  const weekStatusLine =
    weekProgress.planned > 0 && weekProgress.logged >= weekProgress.planned * 0.6
      ? "Du ligger foran ukesmålet ditt"
      : weekProgress.logged > 0
        ? "God fremgang denne uken"
        : "Logg måltider for å følge planen";

  const shoppingGroups = useMemo(() => buildWeeklyShoppingList(plan, foodById), [plan, foodById]);

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
      const next = setMealSwap(tracking, todayKey, swapMeal.id, sourceDayId, sourceMealId);
      setTracking(next);
      persistMemberMealPlanStateLocalAndScheduleCloud(memberId, next);
      setSwapMeal(null);
    },
    [memberId, swapMeal, todayKey, tracking],
  );

  const coachTips = useMemo(() => {
    const tips: string[] = [];
    if (plan.notes.trim()) tips.push(plan.notes.trim());
    tips.push("Få i deg 20–40 g protein i hvert måltid for jevn energi gjennom dagen.");
    tips.push("Prioriter protein tidlig på dagen — det gjør resten av dagen enklere.");
    if (targetProtein > 0 && displayMacros.protein < targetProtein * 0.5) {
      tips.push(`Du har ${formatMacro(targetProtein - displayMacros.protein, 0)} g protein igjen i dag.`);
    }
    return tips;
  }, [displayMacros.protein, plan.notes, targetProtein]);

  const handleToggleMeal = useCallback(
    (mealId: string) => {
      setTracking((prev) => toggleMealLogged(memberId, prev, todayKey, mealId));
    },
    [memberId, todayKey],
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
      const food = foodById.get(item.foodId);
      if (food?.imageUrl) return food.imageUrl;
    }
    return null;
  };

  return (
    <div className="motus-matplan motus-fade-in-up">
      {/* Header */}
      <header className="motus-matplan-header">
        <div className="min-w-0 flex-1">
          <h1 className="motus-matplan-greeting">
            {getTimeBasedGreeting()}, {firstName} 👋
          </h1>
          <p className="motus-matplan-week-status">{weekStatusLine}</p>
        </div>
        <div className="motus-matplan-streak-pill" aria-label={`${streakDays} dager på rad`}>
          <MotusFlameIcon className="h-5 w-5" />
          <div className="motus-matplan-streak-text">
            <span className="motus-matplan-streak-value">{streakDays}</span>
            <span className="motus-matplan-streak-label">dager på rad</span>
          </div>
        </div>
      </header>

      {/* 1. Dagens status */}
      <section className="motus-matplan-section" aria-label="Dagens status">
        <h2 className="motus-matplan-section-title">Dagens status</h2>
        <div className="motus-matplan-status-row">
          <div className="motus-matplan-status-card">
            <MacroProgressRing
              label="Protein"
              current={displayMacros.protein}
              target={targetProtein}
              unit="g"
              size="sm"
            />
          </div>
          <div className="motus-matplan-status-card">
            <MacroProgressRing
              label="Kalorier"
              current={displayMacros.kcal}
              target={targetKcal}
              size="sm"
              sublabel={kcalRemaining > 0 ? `${kcalRemaining} igjen` : "Mål nådd"}
            />
          </div>
          <button
            type="button"
            className="motus-matplan-status-card motus-pressable"
            onClick={() => handleWaterAdjust(WATER_STEP_L)}
            aria-label={`Vann ${waterLiters} av ${WATER_TARGET_L} liter, trykk for å legge til`}
          >
            <MacroProgressRing
              label="Vann"
              current={waterLiters}
              target={WATER_TARGET_L}
              unit="L"
              size="sm"
            />
            <Droplets className="motus-matplan-water-icon" aria-hidden />
          </button>
        </div>
      </section>

      {/* 2. Ukeoversikt */}
      <section className="motus-matplan-section" aria-label="Ukeoversikt">
        <h2 className="motus-matplan-section-title">Ukeoversikt</h2>
        <div className="motus-matplan-week-row">
          {plan.days.map((day, index) => {
            const d = new Date(today);
            d.setDate(today.getDate() - (todayWeekdayIndex - index));
            const dateKey = toIsoDateKey(d);
            const logged = tracking.loggedMeals[dateKey] ?? [];
            const mealsWithFood = day.meals.filter((m) => m.items.length > 0);
            const complete =
              mealsWithFood.length > 0 &&
              mealsWithFood.every((m) => logged.includes(m.id));
            const isToday = index === todayWeekdayIndex;
            const isPast = index < todayWeekdayIndex;
            const hasActivity = logged.length > 0;

            return (
              <div
                key={day.id}
                className={`motus-matplan-week-day ${isToday ? "motus-matplan-week-day--today" : ""}`}
              >
                <span className="motus-matplan-week-day-label">{weekdayShortLabel(index)}</span>
                <div
                  className={`motus-matplan-week-dot ${
                    complete || (isPast && hasActivity)
                      ? "motus-matplan-week-dot--done"
                      : isToday
                        ? "motus-matplan-week-dot--today"
                        : ""
                  }`}
                >
                  {complete || (isPast && hasActivity) ? (
                    <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} aria-hidden />
                  ) : isToday ? (
                    <Flame className="h-3.5 w-3.5" style={{ color: MOTUS.pink }} aria-hidden />
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 3. Dagens måltider */}
      <section className="motus-matplan-section" aria-label="Dagens måltider">
        <div className="motus-matplan-section-head">
          <h2 className="motus-matplan-section-title">Dagens måltider</h2>
          <button
            type="button"
            className="motus-matplan-link-btn"
            onClick={() => {
              const next = todayMealsResolved.find((m) => m.items.length > 0 && !loggedToday.has(m.id));
              if (next) handleToggleMeal(next.id);
            }}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Logg måltid
          </button>
        </div>
        <div className="motus-matplan-meals">
          {todayMealsResolved.map((meal) => {
            const macros = computeMealMacros(meal);
            const logged = loggedToday.has(meal.id);
            const hasFood = meal.items.length > 0;
            const imageSrc = resolveMealImage(meal);
            const isSwapped = Boolean(tracking.mealSwaps[mealSwapKey(todayKey, meal.id)]);

            return (
              <article key={meal.id} className={`motus-matplan-meal-card ${logged ? "motus-matplan-meal-card--logged" : ""}`}>
                <div className="motus-matplan-meal-body">
                  <span className="motus-matplan-meal-slot">{mealSlotLabel(meal.name)}</span>
                  {isSwapped ? <span className="motus-matplan-meal-swapped">Byttet måltid</span> : null}
                  <h3 className="motus-matplan-meal-title">
                    {hasFood ? mealDisplayTitle(meal) : meal.name}
                  </h3>
                  {hasFood ? (
                    <>
                      <p className="motus-matplan-meal-macros">{mealMacroLine(macros)}</p>
                      <ul className="motus-matplan-meal-foods">
                        {meal.items.map((item) => (
                          <li key={item.id} className="motus-matplan-meal-food">
                            <span className="motus-matplan-meal-food-name">{item.foodName}</span>
                            <span className="motus-matplan-meal-food-grams">{item.grams} g</span>
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : (
                    <p className="motus-matplan-meal-macros motus-matplan-meal-macros--muted">
                      Treneren fyller ut dette måltidet
                    </p>
                  )}
                  <div className="motus-matplan-meal-actions">
                    {logged ? (
                      <span className="motus-matplan-logged-badge">
                        <Check className="h-3.5 w-3.5" aria-hidden />
                        Logget
                      </span>
                    ) : hasFood ? (
                      <>
                        <button
                          type="button"
                          className="motus-matplan-btn motus-matplan-btn--mint motus-pressable"
                          onClick={() => setSwapMeal(meal)}
                        >
                          Bytt
                        </button>
                        <button
                          type="button"
                          className="motus-matplan-btn motus-matplan-btn--pink-outline motus-pressable"
                          onClick={() => handleToggleMeal(meal.id)}
                        >
                          <Plus className="h-3.5 w-3.5" aria-hidden />
                          Logg måltid
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>
                <div className="motus-matplan-meal-media">
                  {imageSrc ? (
                    <img src={imageSrc} alt="" className="motus-matplan-meal-img" loading="lazy" />
                  ) : (
                    <div className="motus-matplan-meal-img motus-matplan-meal-img--placeholder" aria-hidden>
                      <UtensilsCrossed className="h-8 w-8 text-white/70" strokeWidth={1.5} />
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* 4. Makro-progress */}
      <section className="motus-matplan-section" aria-label="Makro-progress">
        <h2 className="motus-matplan-section-title">Makro-progress</h2>
        <div className="motus-matplan-macro-rings">
          <MacroProgressRing
            label="Protein"
            current={displayMacros.protein}
            target={targetProtein}
            unit="g"
            tone="mint"
          />
          <MacroProgressRing
            label="Karbohydrater"
            current={displayMacros.carbs}
            target={targetCarbs}
            unit="g"
            tone="mint"
          />
          <MacroProgressRing
            label="Fett"
            current={displayMacros.fat}
            target={targetFat}
            unit="g"
            tone="pink"
          />
        </div>
      </section>

      {/* 5. Coach */}
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
      {shoppingGroups.length > 0 ? (
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
              {shoppingGroups.map((group) => (
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
                            <span className={checked ? "line-through opacity-60" : ""}>
                              {item.name}
                              {item.grams > 0 ? ` (${item.grams} g)` : ""}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
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
                      const macros = computeMealMacros(meal);
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
