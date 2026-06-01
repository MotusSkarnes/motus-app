import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  UtensilsCrossed,
  Wheat,
  X,
} from "lucide-react";
import { MOTUS } from "../../app/data";
import { formatMacro } from "../../app/foodBankTypes";
import type { FoodItem } from "../../app/foodBankTypes";
import { countMealPlanFoodItems } from "../../app/mealPlanCloud";
import { memberMealSlotLabel } from "../../app/memberMealSlots";
import { sumQuickFoodLogMacros } from "../../app/quickFoodLogMacros";
import {
  computeMealMacros,
  sumLoggedMacrosFromFoodItems,
  type MacroTotals,
} from "../../app/mealPlanMacros";
import { MealPlanDisplay } from "../MealPlanDisplay";
import { buildWeeklyShoppingList } from "../../app/mealPlanShoppingList";
import { useInspirationRecipeItems } from "../../app/inspirationRecipeItems";
import type { InspirationRecipeItem } from "../../app/inspirationRecipeItems";
import { computeRecipeMacros } from "../../app/recipeMacros";
import { RecipeIngredientList } from "../../components/RecipeIngredientList";
import { RecipeMacroBlocks } from "../../components/RecipeMacroBlocks";
import { parseInspirationRecipeFoodId } from "../../app/mealPlanRecipeEntry";
import {
  MEAL_PLAN_STATE_CHANGED_EVENT,
  mealSwapKey,
  resolveMealWithSwaps,
  saveMemberMealPlanState,
  setMealSwap,
  type MemberQuickFoodLogEntry,
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
  skipFoodItem,
  unskipFoodItem,
  addQuickFoodLog,
  removeQuickFoodLog,
  toIsoDateKey,
  weekdayShortLabel,
} from "../../app/memberMealPlanTracking";
import type { MealPlan, MealPlanDay, MealPlanFoodEntry, MealPlanMeal, MealPlanTargets } from "../../app/mealPlanTypes";
import { useFoodBankItems } from "../../app/useFoodBankItems";
import { Card } from "../../app/ui";
import { MotusFlameIcon } from "../MotusFlameIcon";
import { MacroProgressBar } from "./MacroProgressBar";
import { MacroProgressRing } from "./MacroProgressRing";
import { InlineMealSelfLog, type SelfLogDraft } from "./InlineMealSelfLog";
import "../../foodbank.css";

const WATER_TARGET_L = 2.5;
const WATER_STEP_L = 0.2;
const RECIPE_PORTION_GRAMS = 100;

function hasMacroValues(nutrition: FoodItem["nutritionPer100g"] | undefined): boolean {
  if (!nutrition) return false;
  return nutrition.kcal > 0 || nutrition.protein > 0 || nutrition.carbs > 0 || nutrition.fat > 0;
}

type MemberMealPlanDashboardProps = {
  plan: MealPlan;
  memberId: string;
  memberName: string;
  onOpenAvoidances?: () => void;
  onRefreshFoodBank?: () => void;
};

function mealSlotLabel(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("frokost")) return "FROKOST";
  if (n.includes("lunsj")) return "LUNSJ";
  if (n.includes("middag")) return "MIDDAG";
  if (n.includes("kvelds")) return "KVELDS";
  if (n.includes("mellom") || n.includes("snack")) return "MELLOMMÅLTID";
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

function normalizeRecipeLookupKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, "og")
    .replace(/[^a-z0-9æøå]+/g, "")
    .trim();
}

function resolveRecipeIdFromEntry(
  item: MealPlanFoodEntry,
  recipesById: Map<string, InspirationRecipeItem>,
  recipeIdByTitleKey: Map<string, string>,
): string | null {
  const parsed = parseInspirationRecipeFoodId(item.foodId);
  if (parsed && recipesById.has(parsed)) return parsed;
  const rawFoodId = item.foodId.trim();
  if (rawFoodId && recipesById.has(rawFoodId)) return rawFoodId;
  const fromTitle = recipeIdByTitleKey.get(normalizeRecipeLookupKey(item.foodName));
  return fromTitle ?? null;
}

function firstRecipeIdFromMeal(
  meal: MealPlanMeal,
  recipesById: Map<string, InspirationRecipeItem>,
  recipeIdByTitleKey: Map<string, string>,
): string | null {
  for (const item of meal.items) {
    const recipeId = resolveRecipeIdFromEntry(item, recipesById, recipeIdByTitleKey);
    if (recipeId) return recipeId;
  }
  return null;
}

export function isRecipeEntry(foodId: string, note?: string): boolean {
  if (Boolean(parseInspirationRecipeFoodId(foodId))) return true;
  return String(note ?? "").toLowerCase().includes("oppskrift");
}

export function formatMealEntryAmount(foodId: string, grams: number, note?: string): string {
  if (!isRecipeEntry(foodId, note)) return `${formatMacro(grams, 0)} g`;
  const portions = Math.max(0.1, Math.round((grams / RECIPE_PORTION_GRAMS) * 10) / 10);
  return portions === 1 ? "1 porsjon" : `${formatMacro(portions, 1)} porsjoner`;
}

export function extractRecipeMethodSteps(body: string): string[] {
  const lines = body.split(/\r?\n/);
  const start = lines.findIndex((line) => /slik gjør du/i.test(line));
  if (start < 0) return [];
  const steps: string[] = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    const raw = lines[i]?.trim() ?? "";
    if (!raw) continue;
    if (/^\*\*.*\*\*$/.test(raw)) break;
    if (/^tips\s*:?/i.test(raw.replace(/^\*\*|\*\*$/g, "").trim())) break;
    const cleaned = raw
      .replace(/^[-*]\s+/, "")
      .replace(/^\d+[\).]?\s+/, "")
      .trim();
    if (cleaned) steps.push(cleaned);
  }
  return steps;
}

function normalizeMealKey(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "");
}

function dateKeyForPlanDayIndex(today: Date, todayWeekdayIndex: number, dayIndex: number): string {
  const d = new Date(today);
  d.setDate(today.getDate() - (todayWeekdayIndex - dayIndex));
  return toIsoDateKey(d);
}

function mealSelfLogs(logs: MemberQuickFoodLogEntry[] | undefined, mealId: string): MemberQuickFoodLogEntry[] {
  return (logs ?? []).filter((entry) => entry.mealId === mealId);
}

function logsOutsidePlanMeals(
  logs: MemberQuickFoodLogEntry[] | undefined,
  planMealIds: Set<string>,
): MemberQuickFoodLogEntry[] {
  return (logs ?? []).filter((entry) => {
    const mealId = entry.mealId?.trim() ?? "";
    return !mealId || !planMealIds.has(mealId);
  });
}

function selfLogMacroLine(entry: MemberQuickFoodLogEntry): string {
  const scale = entry.grams > 0 ? entry.grams / 100 : 0;
  return `${formatMacro(entry.nutritionPer100g.kcal * scale, 0)} kcal · P ${formatMacro(entry.nutritionPer100g.protein * scale, 1)} g`;
}

function isMealComplete(
  meal: MealPlanMeal,
  skippedFood: Set<string>,
  loggedFood: Set<string>,
  selfLogs: MemberQuickFoodLogEntry[],
): boolean {
  const activeItems = meal.items.filter((item) => !skippedFood.has(item.id));
  if (activeItems.length > 0) {
    return activeItems.every((item) => loggedFood.has(item.id));
  }
  return selfLogs.length > 0;
}

export function MemberMealPlanDashboard({ plan, memberId, onOpenAvoidances, onRefreshFoodBank }: MemberMealPlanDashboardProps) {
  const foodItems = useFoodBankItems();
  const { items: inspirationRecipes } = useInspirationRecipeItems();
  const foodById = useMemo(() => new Map(foodItems.map((f) => [f.id, f])), [foodItems]);
  const recipesById = useMemo(
    () => new Map(inspirationRecipes.map((recipe) => [recipe.id, recipe])),
    [inspirationRecipes],
  );
  const recipeIdByTitleKey = useMemo(
    () => new Map(inspirationRecipes.map((recipe) => [normalizeRecipeLookupKey(recipe.title), recipe.id])),
    [inspirationRecipes],
  );
  const recipeNutritionById = useMemo(() => {
    const byId = new Map<string, FoodItem["nutritionPer100g"]>();
    for (const recipe of inspirationRecipes) {
      const macros = computeRecipeMacros(recipe.body, foodItems);
      if (!macros) continue;
      byId.set(recipe.id, {
        kcal: Math.round(macros.perServing.kcal),
        protein: Math.round(macros.perServing.protein * 10) / 10,
        carbs: Math.round(macros.perServing.carbs * 10) / 10,
        fat: Math.round(macros.perServing.fat * 10) / 10,
        fiber: 0,
        sugar: 0,
        saturatedFat: 0,
        sodium: 0,
        micronutrients: { ...macros.perServingMicronutrients },
      });
    }
    return byId;
  }, [inspirationRecipes, foodItems]);

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
  const [activeRecipeId, setActiveRecipeId] = useState<string | null>(null);
  const mealSectionRef = useRef<HTMLDivElement | null>(null);

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
      todayDay.meals.map((meal) => {
        const resolvedMeal = resolveMealWithSwaps(plan, meal, todayKey, tracking.mealSwaps);
        return {
          ...resolvedMeal,
          items: resolvedMeal.items.map((item) => {
            if (hasMacroValues(item.nutritionPer100g)) return item;
            const recipeId = resolveRecipeIdFromEntry(item, recipesById, recipeIdByTitleKey);
            if (!recipeId) return item;
            const fallbackNutrition = recipeNutritionById.get(recipeId);
            if (!fallbackNutrition) return item;
            return { ...item, nutritionPer100g: { ...fallbackNutrition } };
          }),
        };
      }),
    [plan, todayDay.meals, todayKey, tracking.mealSwaps, recipeNutritionById, recipesById, recipeIdByTitleKey],
  );
  const todayDayResolved = useMemo(
    () => ({ ...todayDay, meals: todayMealsResolved }),
    [todayDay, todayMealsResolved],
  );

  const selectedMealsResolved = useMemo(
    () =>
      (selectedDay?.meals ?? []).map((meal) => {
        const resolvedMeal = resolveMealWithSwaps(plan, meal, selectedDateKey, tracking.mealSwaps);
        return {
          ...resolvedMeal,
          items: resolvedMeal.items.map((item) => {
            if (hasMacroValues(item.nutritionPer100g)) return item;
            const recipeId = resolveRecipeIdFromEntry(item, recipesById, recipeIdByTitleKey);
            if (!recipeId) return item;
            const fallbackNutrition = recipeNutritionById.get(recipeId);
            if (!fallbackNutrition) return item;
            return { ...item, nutritionPer100g: { ...fallbackNutrition } };
          }),
        };
      }),
    [plan, selectedDay?.meals, selectedDateKey, tracking.mealSwaps, recipeNutritionById, recipesById, recipeIdByTitleKey],
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
  const skippedFoodToday = useMemo(
    () => new Set(tracking.skippedFoodIds[todayKey] ?? []),
    [tracking.skippedFoodIds, todayKey],
  );
  const skippedFoodSelected = useMemo(
    () => new Set(tracking.skippedFoodIds[selectedDateKey] ?? []),
    [tracking.skippedFoodIds, selectedDateKey],
  );
  const quickLogsToday = useMemo(
    () => tracking.quickFoodLogs[todayKey] ?? [],
    [tracking.quickFoodLogs, todayKey],
  );
  const quickLogsSelected = useMemo(
    () => tracking.quickFoodLogs[selectedDateKey] ?? [],
    [tracking.quickFoodLogs, selectedDateKey],
  );
  const loggedMacrosToday = useMemo(
    () => sumLoggedMacrosFromFoodItems(todayDayResolved, loggedFoodToday, foodById),
    [todayDayResolved, loggedFoodToday, foodById],
  );
  const loggedMacrosSelected = useMemo(() => {
    if (!selectedDayResolved) return loggedMacrosToday;
    return sumLoggedMacrosFromFoodItems(selectedDayResolved, loggedFoodSelected, foodById);
  }, [selectedDayResolved, loggedFoodSelected, foodById, loggedMacrosToday]);
  const quickLogMacrosToday = useMemo(
    () => sumQuickFoodLogMacros(tracking.quickFoodLogs[todayKey]),
    [tracking.quickFoodLogs, todayKey],
  );
  const quickLogMacrosSelected = useMemo(
    () => sumQuickFoodLogMacros(tracking.quickFoodLogs[selectedDateKey]),
    [tracking.quickFoodLogs, selectedDateKey],
  );
  const combinedMacrosToday = useMemo(
    () => ({
      kcal: loggedMacrosToday.kcal + quickLogMacrosToday.kcal,
      protein: loggedMacrosToday.protein + quickLogMacrosToday.protein,
      carbs: loggedMacrosToday.carbs + quickLogMacrosToday.carbs,
      fat: loggedMacrosToday.fat + quickLogMacrosToday.fat,
    }),
    [loggedMacrosToday, quickLogMacrosToday],
  );
  const combinedMacrosSelected = useMemo(
    () => ({
      kcal: loggedMacrosSelected.kcal + quickLogMacrosSelected.kcal,
      protein: loggedMacrosSelected.protein + quickLogMacrosSelected.protein,
      carbs: loggedMacrosSelected.carbs + quickLogMacrosSelected.carbs,
      fat: loggedMacrosSelected.fat + quickLogMacrosSelected.fat,
    }),
    [loggedMacrosSelected, quickLogMacrosSelected],
  );
  const selectedDayFoodCount = selectedMealsResolved.filter((meal) => meal.items.length > 0).length;

  const displayMacrosToday = combinedMacrosToday;
  const displayMacrosProgress = isSelectedToday ? combinedMacrosToday : combinedMacrosSelected;
  const waterLiters = tracking.waterLiters[todayKey] ?? 0;
  const kcalRemaining = Math.max(0, Math.round(targetKcal - displayMacrosToday.kcal));
  const streakDays = computeNutritionStreak(tracking.loggedMeals, tracking.loggedFoodIds);
  const todayMealsWithFood = useMemo(
    () =>
      todayMealsResolved.filter((meal) => {
        const activeItems = meal.items.filter((item) => !skippedFoodToday.has(item.id));
        const selfLogs = mealSelfLogs(quickLogsToday, meal.id);
        return activeItems.length > 0 || selfLogs.length > 0;
      }),
    [todayMealsResolved, skippedFoodToday, quickLogsToday],
  );
  const mealsCompletedCount = useMemo(
    () =>
      todayMealsWithFood.filter((meal) =>
        isMealComplete(meal, skippedFoodToday, loggedFoodToday, mealSelfLogs(quickLogsToday, meal.id)),
      ).length,
    [todayMealsWithFood, skippedFoodToday, loggedFoodToday, quickLogsToday],
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
          if ((tracking.skippedFoodIds[key] ?? []).includes(item.id)) continue;
          planned += 1;
          if (loggedFood.has(item.id)) logged += 1;
        }
      }
    }
    return { logged, planned };
  }, [plan.days, today, todayWeekdayIndex, tracking.loggedFoodIds, tracking.skippedFoodIds]);

  const weekStatusLine =
    weekProgress.planned > 0 && weekProgress.logged >= weekProgress.planned * 0.6
      ? "Du ligger foran ukesmålet ditt"
      : weekProgress.logged > 0
        ? "God fremgang denne uken"
        : "Logg måltider for å følge planen";
  const recipePortions = tracking.recipePortions ?? {};

  const shoppingList = useMemo(
    () =>
      buildWeeklyShoppingList({
        plan,
        foodById,
        foodItems,
        recipesById,
        recipePortions,
      }),
    [plan, foodById, foodItems, recipesById, recipePortions],
  );
  const shoppingGroups = shoppingList.groups;
  const activeRecipe = activeRecipeId ? recipesById.get(activeRecipeId) ?? null : null;
  const activeRecipeSteps = useMemo(
    () => (activeRecipe ? extractRecipeMethodSteps(activeRecipe.body) : []),
    [activeRecipe],
  );

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

  const handleSkipFood = useCallback(
    (foodEntryId: string) => {
      setTracking((prev) =>
        skipFoodItem(memberId, prev, selectedDateKey, selectedMealsResolved, foodEntryId),
      );
    },
    [memberId, selectedDateKey, selectedMealsResolved],
  );

  const handleUnskipFood = useCallback(
    (foodEntryId: string) => {
      setTracking((prev) =>
        unskipFoodItem(memberId, prev, selectedDateKey, selectedMealsResolved, foodEntryId),
      );
    },
    [memberId, selectedDateKey, selectedMealsResolved],
  );

  const handleAddSelfLog = useCallback(
    (draft: SelfLogDraft) => {
      const entry: MemberQuickFoodLogEntry = {
        ...draft,
        id: `log-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
        loggedAt: new Date().toISOString(),
      };
      setTracking((prev) => addQuickFoodLog(memberId, prev, selectedDateKey, entry));
      setExpandedMealId(draft.mealId ?? null);
    },
    [memberId, selectedDateKey],
  );

  const handleRemoveSelfLog = useCallback(
    (entryId: string) => {
      setTracking((prev) => removeQuickFoodLog(memberId, prev, selectedDateKey, entryId));
    },
    [memberId, selectedDateKey],
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
      const recipeId = resolveRecipeIdFromEntry(item, recipesById, recipeIdByTitleKey);
      if (recipeId) {
        const recipeUrl = recipesById.get(recipeId)?.imageUrl?.trim();
        if (recipeUrl) return recipeUrl;
      }
      const food = foodById.get(item.foodId);
      if (food?.imageUrl) return food.imageUrl;
    }
    return null;
  };

  const displayMeals = isSelectedToday ? todayMealsResolved : selectedMealsResolved;
  const displayLoggedFood = isSelectedToday ? loggedFoodToday : loggedFoodSelected;
  const displaySkippedFood = isSelectedToday ? skippedFoodToday : skippedFoodSelected;
  const displayQuickLogs = isSelectedToday ? quickLogsToday : quickLogsSelected;
  const displayMacros = isSelectedToday ? displayMacrosToday : displayMacrosProgress;
  const planMealIds = useMemo(() => new Set(displayMeals.map((meal) => meal.id)), [displayMeals]);
  const outsidePlanLogs = useMemo(
    () => logsOutsidePlanMeals(displayQuickLogs, planMealIds),
    [displayQuickLogs, planMealIds],
  );
  const outsidePlanLogsBySlot = useMemo(() => {
    const grouped = new Map<string, MemberQuickFoodLogEntry[]>();
    for (const entry of outsidePlanLogs) {
      const key = entry.mealId?.trim() || "other";
      const list = grouped.get(key) ?? [];
      list.push(entry);
      grouped.set(key, list);
    }
    return grouped;
  }, [outsidePlanLogs]);

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

  useEffect(() => {
    const modalOpen = Boolean(activeRecipe || showCoachTips || swapMeal);
    if (!modalOpen) return;
    const previousOverflow = document.body.style.overflow;
    const previousOverscroll = document.body.style.overscrollBehavior;
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "contain";
    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.overscrollBehavior = previousOverscroll;
    };
  }, [activeRecipe, showCoachTips, swapMeal]);

  useEffect(() => {
    if (!mealMenuId) return;
    const handlePointerDown = (event: MouseEvent) => {
      const root = mealSectionRef.current;
      if (!root) return;
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (!root.contains(target)) setMealMenuId(null);
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [mealMenuId]);

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

      <section className="motus-matplan-section" aria-label="Måltider" ref={mealSectionRef}>
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
            const activeItems = meal.items.filter((item) => !displaySkippedFood.has(item.id));
            const skippedItems = meal.items.filter((item) => displaySkippedFood.has(item.id));
            const selfLogs = mealSelfLogs(displayQuickLogs, meal.id);
            const hasPlanFood = activeItems.length > 0;
            const hasSelfLogs = selfLogs.length > 0;
            const hasFood = hasPlanFood || hasSelfLogs;
            const displayMealForMacros = hasPlanFood ? { ...meal, items: activeItems } : meal;
            const macros = hasPlanFood
              ? computeMealMacros(displayMealForMacros, foodById)
              : sumQuickFoodLogMacros(selfLogs);
            const loggedFoodCount = activeItems.filter((item) => displayLoggedFood.has(item.id)).length;
            const logged = isMealComplete(meal, displaySkippedFood, displayLoggedFood, selfLogs);
            const hasPartialLog =
              (activeItems.length > 0 && loggedFoodCount > 0 && !logged) || (hasSelfLogs && !logged);
            const recipeId = firstRecipeIdFromMeal(meal, recipesById, recipeIdByTitleKey);
            const hasRecipe = Boolean(recipeId && recipesById.has(recipeId));
            const imageSrc = resolveMealImage(meal);
            const isSwapped = Boolean(tracking.mealSwaps[mealSwapKey(selectedDateKey, meal.id)]);
            const prepMeta = mealPrepMeta(activeItems.length || selfLogs.length);
            const isExpanded = expandedMealId === meal.id;
            const menuOpen = mealMenuId === meal.id;
            const cardTitle = hasSelfLogs && !hasPlanFood
              ? selfLogs.length === 1
                ? selfLogs[0].name
                : `${selfLogs[0].name} m.m.`
              : hasPlanFood
                ? mealDisplayTitle({ ...meal, items: activeItems })
                : meal.name;

            return (
              <article
                key={meal.id}
                className={`motus-matplan-meal-card motus-matplan-meal-card--v2 ${isExpanded ? "motus-matplan-meal-card--expanded" : ""} ${logged ? "motus-matplan-meal-card--logged" : ""} ${hasPartialLog ? "motus-matplan-meal-card--partial" : ""}`}
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
                          {hasPlanFood ? (
                            <button type="button" className="motus-pressable" onClick={() => { setSwapMeal(meal); setMealMenuId(null); }}>
                              Bytt måltid
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="motus-pressable"
                            onClick={() => {
                              setExpandedMealId(isExpanded ? null : meal.id);
                              setMealMenuId(null);
                            }}
                          >
                            {isExpanded ? "Skjul detaljer" : hasFood ? "Vis matvarer" : "Logg mat"}
                          </button>
                          <button
                            type="button"
                            className="motus-pressable"
                            onClick={() => {
                              setExpandedMealId(meal.id);
                              setMealMenuId(null);
                            }}
                          >
                            Logg noe annet
                          </button>
                          {hasRecipe && recipeId && hasPlanFood ? (
                            <button
                              type="button"
                              className="motus-pressable"
                              onClick={() => {
                                setActiveRecipeId(recipeId);
                                setMealMenuId(null);
                              }}
                            >
                              Se oppskrift
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  {isSwapped ? <span className="motus-matplan-meal-swapped">Byttet måltid</span> : null}
                  <h3 className="motus-matplan-meal-card__title">{cardTitle}</h3>
                  {hasFood ? (
                    <>
                      <p className="motus-matplan-meal-card__macros">
                        {mealMacroLine(macros)}
                        {hasSelfLogs ? (
                          <span className="motus-matplan-meal-card__self-badge">
                            {" "}
                            · {selfLogs.length} egen
                          </span>
                        ) : null}
                      </p>
                      {hasPlanFood ? (
                        <div className="motus-matplan-meal-card__meta">
                          <span>
                            <Clock className="h-3.5 w-3.5" aria-hidden />
                            {prepMeta.minutes} min
                          </span>
                          <span>{prepMeta.difficulty}</span>
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <p className="motus-matplan-meal-card__macros motus-matplan-meal-card__macros--muted">
                      Trykk ⋮ for å logge det du spiste
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  className={`motus-matplan-meal-card__check motus-pressable ${logged ? "motus-matplan-meal-card__check--done" : ""}`}
                  onClick={() => hasPlanFood && handleToggleMeal(meal)}
                  disabled={!hasPlanFood}
                  aria-label={logged ? `Måltid fullført` : hasPlanFood ? `Logg ${meal.name}` : `Logg mat for ${meal.name}`}
                >
                  {logged ? <Check className="h-4 w-4" strokeWidth={3} aria-hidden /> : null}
                </button>
                {isExpanded ? (
                  <div className="motus-matplan-meal-detail">
                      {hasPlanFood ? (
                        <ul className="motus-matplan-meal-foods">
                          {activeItems.map((item) => {
                            const foodLogged = displayLoggedFood.has(item.id);
                            return (
                              <li
                                key={item.id}
                                className={`motus-matplan-meal-food ${foodLogged ? "motus-matplan-meal-food--logged" : ""}`}
                              >
                                <div className="motus-matplan-meal-food-main">
                                  <span className="motus-matplan-meal-food-name">{item.foodName}</span>
                                  <span className="motus-matplan-meal-food-grams">
                                    {formatMealEntryAmount(item.foodId, item.grams, item.note)}
                                  </span>
                                </div>
                                <div className="motus-matplan-meal-food-actions">
                                  {foodLogged ? (
                                    <button
                                      type="button"
                                      className="motus-matplan-food-remove motus-pressable"
                                      onClick={() => handleRemoveFood(item.id)}
                                      aria-label={`Fjern ${item.foodName} fra logg`}
                                    >
                                      Fjern
                                    </button>
                                  ) : (
                                    <>
                                      <button
                                        type="button"
                                        className="motus-matplan-food-log motus-pressable"
                                        onClick={() => handleToggleFood(item.id)}
                                        aria-label={`Logg ${item.foodName}`}
                                      >
                                        Logg
                                      </button>
                                      <button
                                        type="button"
                                        className="motus-matplan-food-skip motus-pressable"
                                        onClick={() => handleSkipFood(item.id)}
                                        aria-label={`Hopp over ${item.foodName} fra planen`}
                                      >
                                        Hopp over
                                      </button>
                                    </>
                                  )}
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      ) : null}
                      {skippedItems.length > 0 ? (
                        <ul className="motus-matplan-meal-foods motus-matplan-meal-foods--skipped">
                          {skippedItems.map((item) => (
                            <li key={item.id} className="motus-matplan-meal-food motus-matplan-meal-food--skipped">
                              <div className="motus-matplan-meal-food-main">
                                <span className="motus-matplan-meal-food-name">{item.foodName}</span>
                                <span className="motus-matplan-meal-food-grams">Hoppet over</span>
                              </div>
                              <div className="motus-matplan-meal-food-actions">
                                <button
                                  type="button"
                                  className="motus-matplan-food-log motus-pressable"
                                  onClick={() => handleUnskipFood(item.id)}
                                  aria-label={`Legg ${item.foodName} tilbake i planen`}
                                >
                                  Legg tilbake
                                </button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      {selfLogs.length > 0 ? (
                        <ul className="motus-matplan-meal-foods motus-matplan-meal-foods--self">
                          {selfLogs.map((entry) => (
                            <li key={entry.id} className="motus-matplan-meal-food motus-matplan-meal-food--self">
                              <div className="motus-matplan-meal-food-main">
                                <span className="motus-matplan-meal-food-name">{entry.name}</span>
                                <span className="motus-matplan-meal-food-grams">{formatMacro(entry.grams, 0)} g</span>
                              </div>
                              <div className="motus-matplan-meal-food-meta">{selfLogMacroLine(entry)}</div>
                              <div className="motus-matplan-meal-food-actions">
                                <button
                                  type="button"
                                  className="motus-matplan-food-remove motus-pressable"
                                  onClick={() => handleRemoveSelfLog(entry.id)}
                                  aria-label={`Fjern ${entry.name}`}
                                >
                                  <X className="h-3.5 w-3.5" aria-hidden />
                                  Fjern
                                </button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      <InlineMealSelfLog
                        mealId={meal.id}
                        compact
                        autoOpen
                        onAdd={(draft) => handleAddSelfLog(draft)}
                        onPanelOpen={onRefreshFoodBank}
                      />
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
        {outsidePlanLogs.length > 0 ? (
          <div className="motus-matplan-orphan-logs">
            <h3 className="motus-matplan-orphan-logs__title">Logget utenfor matplanen</h3>
            {[...outsidePlanLogsBySlot.entries()].map(([slotId, entries]) => (
              <div key={slotId} className="motus-matplan-orphan-logs__group">
                <h4 className="motus-matplan-orphan-logs__group-title">{memberMealSlotLabel(slotId)}</h4>
                <ul className="motus-matplan-meal-foods motus-matplan-meal-foods--self">
                  {entries.map((entry) => (
                    <li key={entry.id} className="motus-matplan-meal-food motus-matplan-meal-food--self">
                      <div className="motus-matplan-meal-food-main">
                        <span className="motus-matplan-meal-food-name">{entry.name}</span>
                        <span className="motus-matplan-meal-food-grams">{formatMacro(entry.grams, 0)} g</span>
                      </div>
                      <div className="motus-matplan-meal-food-meta">{selfLogMacroLine(entry)}</div>
                      <div className="motus-matplan-meal-food-actions">
                        <button
                          type="button"
                          className="motus-matplan-food-remove motus-pressable"
                          onClick={() => handleRemoveSelfLog(entry.id)}
                          aria-label={`Fjern ${entry.name}`}
                        >
                          <X className="h-3.5 w-3.5" aria-hidden />
                          Fjern
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : null}
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
                      const portionValue = recipePortions[row.entryId] ?? row.portionMultiplier;
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

      {/* Recipe modal */}
      {activeRecipe ? (
        <div className="motus-foodbank-modal-backdrop" role="presentation" onClick={() => setActiveRecipeId(null)}>
          <div
            className="motus-foodbank-modal motus-foodbank-modal--wide"
            role="dialog"
            aria-label="Se oppskrift"
            onClick={(e) => e.stopPropagation()}
            style={{ maxHeight: "calc(100dvh - 2rem)", overflow: "hidden" }}
          >
            <div className="motus-foodbank-modal-head">
              <h3>{activeRecipe.title}</h3>
              <button
                type="button"
                className="motus-foodbank-icon-btn"
                onClick={() => setActiveRecipeId(null)}
                aria-label="Lukk"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div
              className="motus-foodbank-modal-body space-y-3 overflow-y-auto overscroll-contain pb-6"
              style={{ maxHeight: "calc(100dvh - 8rem)", paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
            >
              {activeRecipe.description ? <p className="text-sm text-slate-600">{activeRecipe.description}</p> : null}
              <RecipeIngredientList body={activeRecipe.body} foodItems={foodItems} recipeId={activeRecipe.id} />
              {activeRecipeSteps.length > 0 ? (
                <section className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                  <h4 className="text-sm font-semibold text-slate-900">Slik gjør du</h4>
                  <ol className="mt-2 list-decimal space-y-1 pl-4 text-sm text-slate-700">
                    {activeRecipeSteps.map((step, index) => (
                      <li key={`${activeRecipe.id}-step-${index}`}>{step}</li>
                    ))}
                  </ol>
                </section>
              ) : null}
              {computeRecipeMacros(activeRecipe.body, foodItems) ? (
                <RecipeMacroBlocks result={computeRecipeMacros(activeRecipe.body, foodItems)!} />
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
