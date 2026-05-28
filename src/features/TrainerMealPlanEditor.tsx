import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  adjustMacroSplit,
  applyMacroSplitToTargets,
  macroSplitFromTargets,
  normalizeMacroSplit,
  normalizeMacroSplitLocks,
  resolveMacroSplit,
  toggleMacroSplitLock,
} from "../app/mealPlanMacroSplit";
import type { MacroSplitField } from "../app/mealPlanMacroSplit";
import { balanceMealPlanTargets, describeTargetBalance } from "../app/mealPlanTargetBalance";
import type { MacroTargetField } from "../app/mealPlanTargetBalance";
import { MacroSplitPercentControls } from "../components/MacroSplitPercentControls";
import { Calendar, Copy, HelpCircle, Plus, Save, Search, ShoppingCart, Soup, Sparkles, Trash2, Wand2, X } from "lucide-react";
import { MEAL_PLAN_CHANGED_EVENT } from "../app/mealPlanStorage";
import {
  flushMealPlanCloudSave,
  mealPlansEqual,
  persistMealPlanBundle,
  persistMealPlanLocalAndScheduleCloud,
  pickPreferredMealPlan,
  syncMealPlanForMember,
} from "../app/mealPlanCloud";
import { useInspirationRecipeItems } from "../app/inspirationRecipeItems";
import { consumeMealPlanPendingFood } from "../app/mealPlanPendingFood";
import { hydrateMealPlanFoodNutrition } from "../app/mealPlanFoodNutrition";
import { computeEntryMacros, computeMealMacros, formatMacroTotals } from "../app/mealPlanMacros";
import {
  copyMealToDays,
  distributeDailyTargetsToMeals,
  previewFoodAddition,
  remainingMacros,
  suggestMealMacroAdjustments,
  suggestFoodsForMacros,
  sumDayMacros,
} from "../app/mealPlanTrainerMacros";
import { buildDefaultFoodBankItems } from "../app/foodBankSeed";
import { formatMacro } from "../app/foodBankTypes";
import { findRecipeFoodAvoidanceConflicts } from "../app/memberFoodAvoidances";
import { computeRecipeMacros } from "../app/recipeMacros";
import { RecipeAvoidanceWarning } from "../components/RecipeAvoidanceWarning";
import { RecipeIngredientList } from "../components/RecipeIngredientList";
import { RecipeMacroBlocks } from "../components/RecipeMacroBlocks";
import { MealMacroMiniBar, TrainerMealPlanMacroPanel } from "./TrainerMealPlanMacroPanel";
import { TrainerMealPlanNutritionOverview } from "./nutrition/TrainerMealPlanNutritionOverview";
import { TrainerMealPlanWeekGrid, type MealGridSelection } from "./nutrition/TrainerMealPlanWeekGrid";
import { autoFillWeekFromMonday, averageWeekMacros } from "../app/mealPlanWeekPlanner";
import { parseInspirationRecipeFoodId, recipeToMealPlanEntry } from "../app/mealPlanRecipeEntry";
import { resolveRecipeMealSlot } from "../app/recipeMealCategory";
import { buildScaledRecipeView, resolveRecipeScalingMode } from "../app/recipeMealScaling";
import type { MealPlan, MealPlanFoodEntry, MealPlanMeal, MealPlanTargets } from "../app/mealPlanTypes";
import type { FoodItem } from "../app/foodBankTypes";
import { useFoodBankItems } from "../app/useFoodBankItems";
import { uid } from "../app/storage";
import { GradientButton, OutlineButton, StatusMessage, TextArea, TextInput } from "../app/ui";
import { MealPlanDisplay } from "./MealPlanDisplay";
import "../foodbank.css";

type TrainerMealPlanEditorProps = {
  memberId: string;
  memberName: string;
  memberGoal?: string;
  memberPersonalGoals?: string;
  trainerOwnerUserId?: string;
};

type MealPickerTarget = {
  dayId: string;
  mealId: string;
};

type FoodPickerState = MealPickerTarget | null;

type RecipePickerState = MealPickerTarget | null;

export function TrainerMealPlanEditor({
  memberId,
  memberName,
  memberGoal = "",
  memberPersonalGoals = "",
  trainerOwnerUserId,
}: TrainerMealPlanEditorProps) {
  const foodItems = useFoodBankItems();
  const foodItemsForMacros = useMemo(
    () => (foodItems.length > 0 ? foodItems : buildDefaultFoodBankItems()),
    [foodItems],
  );
  const { items: recipeItems, loading: recipesLoading } = useInspirationRecipeItems();
  const [plan, setPlan] = useState<MealPlan | null>(null);
  const [activeDayId, setActiveDayId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [foodPicker, setFoodPicker] = useState<FoodPickerState>(null);
  const [recipePicker, setRecipePicker] = useState<RecipePickerState>(null);
  const [foodSearch, setFoodSearch] = useState("");
  const [recipeSearch, setRecipeSearch] = useState("");
  const [recipePreviewId, setRecipePreviewId] = useState<string | null>(null);
  const [foodGrams, setFoodGrams] = useState("100");
  const [pickerSelectedFood, setPickerSelectedFood] = useState<FoodItem | null>(null);
  const [derivedTargetField, setDerivedTargetField] = useState<MacroTargetField | null>(null);
  const [targetBalanceWarning, setTargetBalanceWarning] = useState<string | null>(null);
  const [copyMeal, setCopyMeal] = useState<{ dayId: string; mealId: string; mealName: string } | null>(null);
  const [copyTargetDayIds, setCopyTargetDayIds] = useState<string[]>([]);
  const [gridSelection, setGridSelection] = useState<MealGridSelection | null>(null);
  const [previewSelection, setPreviewSelection] = useState<MealGridSelection | null>(null);
  const [recipeReadOnlyId, setRecipeReadOnlyId] = useState<string | null>(null);
  const [planWeeks, setPlanWeeks] = useState<"1" | "2" | "4" | "custom">("1");
  const reloadInFlightRef = useRef(false);
  const hasLoadedOnceRef = useRef(false);
  const recipesById = useMemo(() => new Map(recipeItems.map((recipe) => [recipe.id, recipe])), [recipeItems]);

  const applyPendingFood = useCallback(
    (currentPlan: MealPlan) => {
      const pending = consumeMealPlanPendingFood(memberId);
      if (!pending) return currentPlan;
      const day = currentPlan.days[0];
      const meal = day?.meals[0];
      if (!day || !meal) return currentPlan;
      const grams =
        Number.isFinite(pending.grams) && pending.grams > 0
          ? Math.round(pending.grams)
          : pending.food.portionGrams || 100;
      const entry: MealPlanFoodEntry = {
        id: uid("meal-food"),
        foodId: pending.food.id,
        foodName: pending.food.name,
        grams,
        nutritionPer100g: { ...pending.food.nutritionPer100g },
      };
      const nextDays = currentPlan.days.map((row) =>
        row.id === day.id
          ? {
              ...row,
              meals: row.meals.map((rowMeal) =>
                rowMeal.id === meal.id ? { ...rowMeal, items: [...rowMeal.items, entry] } : rowMeal,
              ),
            }
          : row,
      );
      setSaveStatus(`${pending.food.name} er lagt til i ${meal.name}.`);
      return { ...currentPlan, days: nextDays };
    },
    [memberId],
  );

  const reload = useCallback(async () => {
    if (!memberId.trim() || reloadInFlightRef.current) return;
    reloadInFlightRef.current = true;
    const showLoading = !hasLoadedOnceRef.current;
    if (showLoading) setLoading(true);
    try {
      const result = await syncMealPlanForMember(memberId, trainerOwnerUserId ?? "");
      const withPending = applyPendingFood(result.plan);
      const hydratedRaw = withPending
        ? hydrateMealPlanFoodNutrition(withPending, foodItemsForMacros)
        : withPending;
      setPlan((prev) => {
        if (!prev) return hydratedRaw;
        const picked = pickPreferredMealPlan([prev, hydratedRaw]) ?? hydratedRaw;
        const next = picked ? hydrateMealPlanFoodNutrition(picked, foodItemsForMacros) : picked;
        return mealPlansEqual(prev, next) ? prev : next;
      });
      if (hydratedRaw && !mealPlansEqual(hydratedRaw, result.plan)) {
        persistMealPlanLocalAndScheduleCloud(trainerOwnerUserId, hydratedRaw, { notify: false });
      }
      setActiveDayId((prev) => prev || hydratedRaw?.days[0]?.id || "");
      hasLoadedOnceRef.current = true;
    } finally {
      reloadInFlightRef.current = false;
      if (showLoading) setLoading(false);
    }
  }, [memberId, trainerOwnerUserId, applyPendingFood, foodItemsForMacros]);

  useEffect(() => {
    hasLoadedOnceRef.current = false;
    setPlan(null);
    setActiveDayId("");
    setLoading(true);
  }, [memberId]);

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

  const foodById = useMemo(() => new Map(foodItems.map((food) => [food.id, food])), [foodItems]);

  const weekAverageMacros = useMemo(
    () => (plan ? averageWeekMacros(plan, foodById) : { kcal: 0, protein: 0, carbs: 0, fat: 0 }),
    [plan, foodById],
  );

  const selectedGridMeal = useMemo(() => {
    if (!plan || !gridSelection) return null;
    const day = plan.days.find((row) => row.id === gridSelection.dayId);
    return day?.meals.find((meal) => meal.id === gridSelection.mealId) ?? null;
  }, [plan, gridSelection]);

  const selectedGridDay = useMemo(() => {
    if (!plan || !gridSelection) return null;
    return plan.days.find((row) => row.id === gridSelection.dayId) ?? null;
  }, [plan, gridSelection]);

  const previewMeal = useMemo(() => {
    if (!plan || !previewSelection) return null;
    const day = plan.days.find((row) => row.id === previewSelection.dayId);
    if (!day) return null;
    const meal = day.meals.find((row) => row.id === previewSelection.mealId);
    if (!meal) return null;
    return { day, meal };
  }, [plan, previewSelection]);

  const recipeReadOnly = useMemo(
    () => (recipeReadOnlyId ? recipeItems.find((row) => row.id === recipeReadOnlyId) ?? null : null),
    [recipeReadOnlyId, recipeItems],
  );

  const dayUsed = useMemo(
    () => (activeDay ? sumDayMacros(activeDay, foodById) : { kcal: 0, protein: 0, carbs: 0, fat: 0 }),
    [activeDay, foodById],
  );
  const dayRemaining = useMemo(
    () => remainingMacros(plan?.targets, dayUsed),
    [plan?.targets, dayUsed],
  );
  const macroAdjustmentSuggestions = useMemo(
    () => (activeDay ? suggestMealMacroAdjustments(activeDay, plan?.targets, foodItems, foodById) : []),
    [activeDay, plan?.targets, foodItems, foodById],
  );

  const pickerMeal = useMemo(() => {
    if (!foodPicker || !plan) return null;
    const day = plan.days.find((d) => d.id === foodPicker.dayId);
    return day?.meals.find((m) => m.id === foodPicker.mealId) ?? null;
  }, [foodPicker, plan]);

  const pickerMealUsed = useMemo(
    () => (pickerMeal ? computeMealMacros(pickerMeal, foodById) : null),
    [pickerMeal, foodById],
  );

  const pickerRemaining = useMemo(() => {
    if (!foodPicker || !plan) return dayRemaining;
    const meal = pickerMeal;
    if (meal?.targets) {
      return remainingMacros(meal.targets, pickerMealUsed ?? { kcal: 0, protein: 0, carbs: 0, fat: 0 });
    }
    return dayRemaining;
  }, [foodPicker, plan, pickerMeal, pickerMealUsed, dayRemaining]);

  const suggestedFoods = useMemo(
    () => suggestFoodsForMacros(foodItems, pickerRemaining, 6),
    [foodItems, pickerRemaining],
  );

  const filteredFoods = useMemo(() => {
    const q = foodSearch.trim().toLowerCase();
    let list = foodItems;
    if (q) list = list.filter((item) => item.name.toLowerCase().includes(q));
    return list.slice(0, 40);
  }, [foodItems, foodSearch]);

  const filteredRecipes = useMemo(() => {
    const q = recipeSearch.trim().toLowerCase();
    let list = recipeItems;
    if (q) {
      list = list.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.tag.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q),
      );
    }
    return list.slice(0, 40);
  }, [recipeItems, recipeSearch]);

  const previewRecipe = useMemo(
    () => recipeItems.find((row) => row.id === recipePreviewId) ?? null,
    [recipeItems, recipePreviewId],
  );

  const previewRecipeScaled = useMemo(() => {
    if (!previewRecipe) return null;
    const mealSlot = resolveRecipeMealSlot(previewRecipe.tag, previewRecipe.title, previewRecipe.description);
    const scalingMode = resolveRecipeScalingMode({
      id: previewRecipe.id,
      scalingMode: previewRecipe.scalingMode,
      body: previewRecipe.body,
      title: previewRecipe.title,
      tag: previewRecipe.tag,
    });
    return buildScaledRecipeView(previewRecipe.body, foodItemsForMacros, {
      scalingMode,
      dailyTargets: plan?.targets,
      mealSlot,
    });
  }, [previewRecipe, foodItemsForMacros, plan?.targets]);

  const previewRecipeMacros = previewRecipeScaled?.macros ?? null;

  const previewRecipeAvoidanceConflicts = useMemo(() => {
    if (!previewRecipe) return [];
    return findRecipeFoodAvoidanceConflicts(previewRecipe.body, foodItemsForMacros, [
      { id: memberId, name: memberName, personalGoals: memberPersonalGoals, isActive: true },
    ]);
  }, [foodItemsForMacros, memberId, memberName, memberPersonalGoals, previewRecipe]);

  const gramPreview = useMemo(() => {
    if (!foodPicker || !foodGrams.trim() || !pickerSelectedFood) return null;
    const grams = Number(foodGrams.replace(",", "."));
    if (!Number.isFinite(grams) || grams <= 0) return null;
    return previewFoodAddition(pickerSelectedFood, grams, pickerRemaining);
  }, [foodPicker, foodGrams, pickerSelectedFood, pickerRemaining]);

  const aiHash = useCallback((value: string) => {
    let hash = 0;
    for (let index = 0; index < value.length; index += 1) {
      hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
    }
    return hash;
  }, []);

  const suggestAiPlanForDay = useCallback(
    (dayId: string, basePlan?: MealPlan, carriedUsedRecipeIds?: Set<string>): MealPlan | null => {
      const sourcePlan = basePlan ?? plan;
      if (!sourcePlan || recipeItems.length === 0) return null;
      const day = sourcePlan.days.find((row) => row.id === dayId);
      if (!day) return null;
      const usedRecipeIds = carriedUsedRecipeIds ?? new Set<string>();
      const pickedForCurrentDay = new Set<string>();

      const mealTargets = day.meals.length
        ? distributeDailyTargetsToMeals(day, sourcePlan.targets, "standard")
        : day.meals;
      const targetByMealId = new Map(mealTargets.map((meal) => [meal.id, meal.targets]));

      const pickRecipeForMeal = (meal: MealPlanMeal): (typeof recipeItems)[number] | null => {
        const mealNameKey = meal.name.trim().toLowerCase();
        const preferredSlot =
          mealNameKey.includes("frokost")
            ? "frokost"
            : mealNameKey.includes("lunsj")
              ? "lunsj"
              : mealNameKey.includes("middag")
                ? "middag"
                : mealNameKey.includes("kveld")
                  ? "kveldsmat"
                  : null;

        const scoped = preferredSlot
          ? recipeItems.filter(
              (recipe) => resolveRecipeMealSlot(recipe.tag, recipe.title, recipe.description) === preferredSlot,
            )
          : recipeItems;
        const candidates = scoped.length > 0 ? scoped : recipeItems;
        if (!candidates.length) return null;

        const mealTargetKcal =
          targetByMealId.get(meal.id)?.kcal ??
          (typeof sourcePlan.targets?.kcal === "number" && day.meals.length > 0
            ? sourcePlan.targets.kcal / day.meals.length
            : 0);

        const ranked = candidates
          .map((recipe) => {
            const mealSlot = resolveRecipeMealSlot(recipe.tag, recipe.title, recipe.description);
            const scalingMode = resolveRecipeScalingMode({
              id: recipe.id,
              scalingMode: recipe.scalingMode,
              body: recipe.body,
              title: recipe.title,
              tag: recipe.tag,
            });
            const scaled = buildScaledRecipeView(recipe.body, foodItemsForMacros, {
              scalingMode,
              dailyTargets: sourcePlan.targets,
              mealSlot,
            });
            const kcal = scaled?.macros?.perServing.kcal ?? computeRecipeMacros(recipe.body, foodItemsForMacros)?.perServing.kcal ?? 0;
            const distance = mealTargetKcal > 0 ? Math.abs(kcal - mealTargetKcal) : 0;
            const repeatPenalty = usedRecipeIds.has(recipe.id) ? 180 : 0;
            const sameDayPenalty = pickedForCurrentDay.has(recipe.id) ? 260 : 0;
            const score = distance + repeatPenalty + sameDayPenalty;
            return { recipe, score };
          })
          .sort((a, b) => a.score - b.score);

        const poolSize = Math.min(3, ranked.length);
        const pool = ranked.slice(0, poolSize);
        if (!pool.length) return null;
        const seed = `${day.id}:${meal.id}:${day.label}`;
        const selected = pool[aiHash(seed) % pool.length]?.recipe ?? pool[0]?.recipe ?? null;
        return selected;
      };

      const nextDayMeals = day.meals.map((meal) => {
        const picked = pickRecipeForMeal(meal);
        if (!picked) return meal;
        pickedForCurrentDay.add(picked.id);
        usedRecipeIds.add(picked.id);
        const mealSlot = resolveRecipeMealSlot(picked.tag, picked.title, picked.description);
        const entry = recipeToMealPlanEntry(picked, foodItems, {
          dailyTargets: sourcePlan.targets,
          mealSlot,
        });
        return {
          ...meal,
          items: [entry],
        };
      });

      return {
        ...sourcePlan,
        days: sourcePlan.days.map((row) =>
          row.id === day.id
            ? {
                ...row,
                meals: nextDayMeals,
              }
            : row,
        ),
      };
    },
    [plan, recipeItems, foodItemsForMacros, foodItems, aiHash],
  );

  function suggestAiDayPlan() {
    if (!activeDay) {
      setSaveStatus("AI-forslag krever en aktiv dag.");
      return;
    }
    const next = suggestAiPlanForDay(activeDay.id);
    if (!next) {
      setSaveStatus("AI-forslag krever tilgjengelige oppskrifter.");
      return;
    }
    updatePlan(next);
    setSaveStatus(`AI-forslag la inn oppskriftsforslag for ${activeDay.label}.`);
  }

  function suggestAiWeekPlan() {
    if (!plan || recipeItems.length === 0) {
      setSaveStatus("AI-generer uke krever tilgjengelige oppskrifter.");
      return;
    }
    const usedRecipeIds = new Set<string>();
    for (const day of plan.days) {
      for (const meal of day.meals) {
        for (const item of meal.items) {
          const recipeId = parseInspirationRecipeFoodId(item.foodId);
          if (recipeId) usedRecipeIds.add(recipeId);
        }
      }
    }
    let nextPlan: MealPlan = plan;
    for (const day of plan.days) {
      nextPlan = suggestAiPlanForDay(day.id, nextPlan, usedRecipeIds) ?? nextPlan;
    }
    updatePlan(nextPlan);
    setSaveStatus("AI-genererte forslag lagt inn for hele uken.");
  }

  function applyMacroSuggestion(suggestion: {
    mealId: string;
    foodId: string;
    foodName: string;
    grams: number;
  }) {
    if (!activeDay) return;
    const food = foodById.get(suggestion.foodId) ?? foodItems.find((row) => row.id === suggestion.foodId);
    if (!food) {
      setSaveStatus(`Fant ikke ${suggestion.foodName} i matvarebanken.`);
      return;
    }
    const entry: MealPlanFoodEntry = {
      id: uid("meal-food"),
      foodId: food.id,
      foodName: food.name,
      grams: suggestion.grams,
      nutritionPer100g: { ...food.nutritionPer100g },
    };
    appendEntryToMeal({ dayId: activeDay.id, mealId: suggestion.mealId }, entry);
    setSaveStatus(`La til ${suggestion.grams} g ${food.name} i ${activeDay.label}.`);
  }

  function updatePlan(next: MealPlan, options?: { flushCloud?: boolean }) {
    const stamped: MealPlan = { ...next, updatedAt: new Date().toISOString() };
    setPlan(stamped);
    persistMealPlanLocalAndScheduleCloud(trainerOwnerUserId, stamped, { notify: false });
    if (options?.flushCloud) flushMealPlanCloudSave(trainerOwnerUserId ?? "");
  }

  function appendEntryToMeal(target: MealPickerTarget, entry: MealPlanFoodEntry, options?: { flushCloud?: boolean }) {
    setPlan((current) => {
      if (!current) return current;
      const nextDays = current.days.map((day) => {
        if (day.id !== target.dayId) return day;
        return {
          ...day,
          meals: day.meals.map((meal) =>
            meal.id === target.mealId ? { ...meal, items: [...meal.items, entry] } : meal,
          ),
        };
      });
      const next: MealPlan = { ...current, days: nextDays, updatedAt: new Date().toISOString() };
      persistMealPlanLocalAndScheduleCloud(trainerOwnerUserId, next, { notify: false });
      if (options?.flushCloud) flushMealPlanCloudSave(trainerOwnerUserId ?? "");
      return next;
    });
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

  const targetBalanceHint = useMemo(() => {
    if (!plan?.targets) return null;
    return describeTargetBalance(plan.targets, derivedTargetField);
  }, [plan?.targets, derivedTargetField]);

  const macroSplit = useMemo(() => resolveMacroSplit(plan?.targets), [plan?.targets]);
  const macroSplitLocked = useMemo(
    () => normalizeMacroSplitLocks(plan?.targets?.macroSplitLocked),
    [plan?.targets?.macroSplitLocked],
  );

  function applyMacroSplitState(nextSplit: ReturnType<typeof resolveMacroSplit>, locks: MacroSplitField[]) {
    if (!plan) return;
    const base: MealPlanTargets = {
      ...(plan.targets ?? {}),
      macroSplitPct: nextSplit,
      macroSplitLocked: locks.length ? locks : undefined,
    };
    const hasKcal = typeof base.kcal === "number" && base.kcal > 0;
    const nextTargets = hasKcal ? applyMacroSplitToTargets(base, nextSplit) : base;

    if (hasKcal) {
      setDerivedTargetField(null);
      setTargetBalanceWarning(null);
    }

    updatePlan({
      ...plan,
      targets: Object.keys(nextTargets).length ? nextTargets : undefined,
    });
  }

  function updateMacroSplit(field: MacroSplitField, value: string) {
    if (!plan) return;
    const parsed = Number(value.replace(",", "."));
    const locks = normalizeMacroSplitLocks(plan.targets?.macroSplitLocked);
    const current = resolveMacroSplit(plan.targets);
    const nextSplit =
      value.trim() && Number.isFinite(parsed)
        ? adjustMacroSplit(current, field, parsed, locks)
        : current;

    applyMacroSplitState(nextSplit, locks);
  }

  function handleToggleMacroSplitLock(field: MacroSplitField) {
    if (!plan) return;
    const locks = normalizeMacroSplitLocks(plan.targets?.macroSplitLocked);
    const nextLocks = toggleMacroSplitLock(locks, field);
    if (nextLocks.length === locks.length && !locks.includes(field)) return;

    const current = resolveMacroSplit(plan.targets);
    const normalized = normalizeMacroSplit(current, nextLocks);
    applyMacroSplitState(normalized, nextLocks);
  }

  function updateTargets(field: keyof MealPlanTargets, value: string) {
    if (!plan) return;
    const parsed = Number(value.replace(",", "."));
    const nextTargets: MealPlanTargets = { ...(plan.targets ?? {}) };
    if (!value.trim() || !Number.isFinite(parsed)) {
      delete nextTargets[field];
      if (field === derivedTargetField) setDerivedTargetField(null);
    } else {
      nextTargets[field] = field === "kcal" ? Math.round(parsed) : parsed;
    }

    const hasAny =
      Object.keys(nextTargets).length > 0 &&
      Object.values(nextTargets).some((v) => typeof v === "number" && Number.isFinite(v));

    if (!hasAny) {
      setDerivedTargetField(null);
      setTargetBalanceWarning(null);
      updatePlan({ ...plan, targets: undefined });
      return;
    }

    const balanced = balanceMealPlanTargets(nextTargets, field);
    let finalTargets = balanced.targets;
    const hasKcal = typeof finalTargets.kcal === "number" && finalTargets.kcal > 0;

    if (hasKcal && field === "kcal") {
      const split = resolveMacroSplit(finalTargets);
      finalTargets = applyMacroSplitToTargets({ ...finalTargets, macroSplitPct: split }, split);
      setDerivedTargetField(null);
      setTargetBalanceWarning(null);
    } else if (hasKcal && (field === "protein" || field === "carbs" || field === "fat")) {
      const split = macroSplitFromTargets(finalTargets);
      if (split) finalTargets = { ...finalTargets, macroSplitPct: split };
      setDerivedTargetField(balanced.derivedField);
      setTargetBalanceWarning(balanced.warning);
    } else {
      setDerivedTargetField(balanced.derivedField);
      setTargetBalanceWarning(balanced.warning);
    }

    updatePlan({
      ...plan,
      targets: Object.keys(finalTargets).length ? finalTargets : undefined,
    });
  }

  function selectFoodForPicker(food: FoodItem) {
    setPickerSelectedFood(food);
    setFoodGrams(String(food.portionGrams || 100));
  }

  function addFoodToMeal(food?: FoodItem) {
    const chosen = food ?? pickerSelectedFood;
    if (!plan || !foodPicker || !chosen) return;
    const grams = Number(foodGrams.replace(",", "."));
    const safeGrams = Number.isFinite(grams) && grams > 0 ? Math.round(grams) : chosen.portionGrams || 100;
    const entry: MealPlanFoodEntry = {
      id: uid("meal-food"),
      foodId: chosen.id,
      foodName: chosen.name,
      grams: safeGrams,
      nutritionPer100g: { ...chosen.nutritionPer100g },
    };
    appendEntryToMeal(foodPicker, entry);
    setFoodPicker(null);
    setFoodSearch("");
    setPickerSelectedFood(null);
    setFoodGrams("100");
  }

  function updateFoodEntryGrams(dayId: string, mealId: string, entryId: string, gramsValue: string) {
    if (!plan) return;
    const parsed = Number(gramsValue.replace(",", "."));
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    const safeGrams = Math.round(parsed);
    updatePlan({
      ...plan,
      days: plan.days.map((day) => {
        if (day.id !== dayId) return day;
        return {
          ...day,
          meals: day.meals.map((meal) => {
            if (meal.id !== mealId) return meal;
            return {
              ...meal,
              items: meal.items.map((item) =>
                item.id === entryId ? { ...item, grams: safeGrams } : item,
              ),
            };
          }),
        };
      }),
    });
  }

  function addRecipeToMeal(recipeId: string) {
    const target = recipePicker;
    if (!target) return;
    const recipe = recipeItems.find((row) => row.id === recipeId);
    if (!recipe) {
      setSaveStatus("Fant ikke oppskriften. Prøv å laste siden på nytt.");
      return;
    }
    const mealSlot = resolveRecipeMealSlot(recipe.tag, recipe.title, recipe.description);
    const entry = recipeToMealPlanEntry(recipe, foodItems, {
      dailyTargets: plan?.targets,
      mealSlot,
    });
    appendEntryToMeal(target, entry, { flushCloud: true });
    setRecipePicker(null);
    setRecipeSearch("");
    setRecipePreviewId(null);
    const macroOk = entry.nutritionPer100g.kcal > 0;
    setSaveStatus(
      macroOk
        ? `${recipe.title} er lagt til i måltidet.`
        : `${recipe.title} er lagt til uten makro — bruk **Ingredienser**-liste under Ernæring for automatisk beregning.`,
    );
  }

  function openFoodPicker(dayId: string, mealId: string) {
    setFoodPicker({ dayId, mealId });
    setFoodSearch("");
    setPickerSelectedFood(null);
    setFoodGrams("100");
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

  function handleDistributeMeals(mode: "equal" | "standard") {
    if (!plan || !activeDay || !plan.targets) return;
    const meals = distributeDailyTargetsToMeals(activeDay, plan.targets, mode);
    updatePlan({
      ...plan,
      days: plan.days.map((day) => (day.id === activeDay.id ? { ...day, meals } : day)),
    });
    setSaveStatus(mode === "standard" ? "Makro fordelt på frokost/lunsj/middag/snacks." : "Makro fordelt likt på alle måltid.");
  }

  function handleClearMealTargets() {
    if (!plan || !activeDay) return;
    updatePlan({
      ...plan,
      days: plan.days.map((day) =>
        day.id === activeDay.id
          ? {
              ...day,
              meals: day.meals.map((meal) => {
                const { targets: _removed, ...rest } = meal;
                return rest;
              }),
            }
          : day,
      ),
    });
  }

  function openCopyMeal(dayId: string, meal: MealPlanMeal) {
    if (meal.items.length === 0) {
      setSaveStatus("Legg til matvarer i måltidet før du kopierer.");
      return;
    }
    setCopyMeal({ dayId, mealId: meal.id, mealName: meal.name });
    setCopyTargetDayIds(plan?.days.filter((d) => d.id !== dayId).map((d) => d.id) ?? []);
  }

  function handleConfirmCopyMeal() {
    if (!plan || !copyMeal || copyTargetDayIds.length === 0) {
      setCopyMeal(null);
      return;
    }
    const next = copyMealToDays(plan, copyMeal.dayId, copyMeal.mealId, copyTargetDayIds, "append");
    updatePlan(next);
    setCopyMeal(null);
    setSaveStatus(`${copyMeal.mealName} kopiert til ${copyTargetDayIds.length} dag(er).`);
  }

  function selectGridCell(selection: MealGridSelection) {
    setGridSelection(selection);
    setActiveDayId(selection.dayId);
  }

  function previewGridCell(selection: MealGridSelection) {
    setPreviewSelection(selection);
    setGridSelection(selection);
    setActiveDayId(selection.dayId);
  }

  function clearGridMeal(selection: MealGridSelection) {
    if (!plan) return;
    updatePlan({
      ...plan,
      days: plan.days.map((day) =>
        day.id === selection.dayId
          ? {
              ...day,
              meals: day.meals.map((meal) =>
                meal.id === selection.mealId ? { ...meal, items: [] } : meal,
              ),
            }
          : day,
      ),
    });
    setSaveStatus("Måltid tømt.");
  }

  function handleAutoFillWeek() {
    if (!plan) return;
    const next = autoFillWeekFromMonday(plan);
    updatePlan(next);
    setSaveStatus("Mandagens måltider er kopiert til resten av uken.");
  }

  if ((loading && !hasLoadedOnceRef.current) || !plan) {
    return <div className="rounded-xl border bg-slate-50 px-4 py-6 text-sm text-slate-600">Laster matplan …</div>;
  }

  return (
    <div className="motus-pt-planner">
      <div className="motus-pt-planner__top-actions">
        <OutlineButton type="button" className="text-xs" onClick={() => setSaveStatus("Hjelp: Bygg uken i rutenettet. Klikk en celle for detaljer.")}>
          <HelpCircle className="h-4 w-4" aria-hidden />
          Hjelp
        </OutlineButton>
        <GradientButton onClick={() => void handleSave()} className="shrink-0">
          <Save className="h-4 w-4" aria-hidden />
          Lagre matplan
        </GradientButton>
      </div>

      {saveStatus ? (
        <StatusMessage
          message={saveStatus}
          tone={/lagret|lagt til|kopiert|tømt/i.test(saveStatus) ? "success" : "error"}
          className="!rounded-xl !px-3 !py-2 !text-xs"
        />
      ) : null}

      <div className="motus-pt-planner__layout">
        <div className="motus-pt-planner__main">
          <section className="motus-pt-planner-step">
            <h2 className="motus-pt-planner-step__title">
              <span className="motus-pt-planner-step__num">1</span> Velg klient
            </h2>
            <div className="motus-pt-planner-client-card">
              <div>
                <div className="font-bold text-slate-900">{memberName}</div>
                <div className="text-sm text-slate-600">{memberGoal.trim() || "Ingen mål satt"}</div>
              </div>
              <div className="motus-pt-planner-client-macros">
                {plan.targets?.kcal ? <span>{formatMacro(plan.targets.kcal, 0)} kcal</span> : null}
                {plan.targets?.protein ? <span>{formatMacro(plan.targets.protein, 0)} g protein</span> : null}
                {plan.targets?.carbs ? <span>{formatMacro(plan.targets.carbs, 0)} g karbo</span> : null}
                {plan.targets?.fat ? <span>{formatMacro(plan.targets.fat, 0)} g fett</span> : null}
              </div>
            </div>
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs font-medium text-slate-700">Daglige makromål</div>
              <div className="mt-2">
                <MacroSplitPercentControls
                  split={macroSplit}
                  locked={macroSplitLocked}
                  onChange={updateMacroSplit}
                  onToggleLock={handleToggleMacroSplitLock}
                />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {(
                  [
                    ["kcal", "Kalorier"],
                    ["protein", "Protein (g)"],
                    ["carbs", "Karbohydrater (g)"],
                    ["fat", "Fett (g)"],
                  ] as const
                ).map(([field, label]) => {
                  const isDerived = derivedTargetField === field;
                  return (
                    <label key={field} className="space-y-1 text-[11px] font-medium text-slate-600">
                      <span>
                        {label}
                        {isDerived ? <span className="ml-1 font-normal text-teal-700">(beregnet)</span> : null}
                      </span>
                      <TextInput
                        value={plan.targets?.[field] !== undefined ? String(plan.targets[field]) : ""}
                        onChange={(e) => updateTargets(field, e.target.value)}
                        inputMode="decimal"
                        className={isDerived ? "border-teal-200 bg-teal-50/50" : undefined}
                      />
                    </label>
                  );
                })}
              </div>
              {targetBalanceWarning ? (
                <p className="mt-2 text-[11px] font-medium text-rose-700">{targetBalanceWarning}</p>
              ) : targetBalanceHint ? (
                <p className="mt-2 text-[11px] text-slate-600">{targetBalanceHint}</p>
              ) : null}
            </div>
          </section>

          <section className="motus-pt-planner-step">
            <h2 className="motus-pt-planner-step__title">
              <span className="motus-pt-planner-step__num">2</span> Velg periode
            </h2>
            <div className="motus-pt-planner-period">
              {(
                [
                  ["1", "1 uke"],
                  ["2", "2 uker"],
                  ["4", "4 uker"],
                  ["custom", "Tilpasset"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`motus-pt-planner-period__btn ${planWeeks === id ? "is-active" : ""}`}
                  onClick={() => setPlanWeeks(id)}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="motus-pt-planner-period__dates">
              <Calendar className="inline h-3.5 w-3.5" aria-hidden /> Uke 1 · {plan.days[0]?.label} – {plan.days[plan.days.length - 1]?.label}
              {planWeeks !== "1" ? " (flere uker kommer snart)" : ""}
            </p>
          </section>

          <section className="motus-pt-planner-step">
            <h2 className="motus-pt-planner-step__title">
              <span className="motus-pt-planner-step__num">3</span> Bygg matplan
            </h2>
            <div className="motus-pt-planner-toolbar">
              <OutlineButton type="button" onClick={suggestAiDayPlan}>
                <Sparkles className="h-4 w-4" aria-hidden />
                AI-forslag
              </OutlineButton>
              <OutlineButton type="button" disabled className="opacity-60">
                <Copy className="h-4 w-4" aria-hidden />
                Kopier fra mal
              </OutlineButton>
              <OutlineButton type="button" onClick={handleAutoFillWeek}>
                <Wand2 className="h-4 w-4" aria-hidden />
                Auto-fyll uke
              </OutlineButton>
            </div>
            <TrainerMealPlanWeekGrid
              plan={plan}
              foodById={foodById}
              recipesById={recipesById}
              selection={gridSelection}
              onSelect={selectGridCell}
              onPreview={previewGridCell}
              onCloseMenu={() => setGridSelection(null)}
              onAddFood={(sel) => openFoodPicker(sel.dayId, sel.mealId)}
              onAddRecipe={(sel) => {
                setRecipePicker(sel);
                setRecipeSearch("");
              }}
              onClearMeal={clearGridMeal}
            />

            {selectedGridMeal && selectedGridDay && gridSelection ? (
              <div className="motus-pt-planner-detail">
                <div className="motus-pt-planner-detail__head">
                  <h3 className="font-bold text-slate-900">
                    {selectedGridMeal.name} · {selectedGridDay.label}
                  </h3>
                  <span className="text-xs text-slate-500">{formatMacroTotals(computeMealMacros(selectedGridMeal, foodById))}</span>
                </div>
                <MealMacroMiniBar
                  mealName={selectedGridMeal.name}
                  used={computeMealMacros(selectedGridMeal, foodById)}
                  targets={selectedGridMeal.targets}
                />
                <ul className="mt-2 space-y-2">
                  {selectedGridMeal.items.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50 px-2 py-1.5 text-sm"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="font-medium text-slate-800">{item.foodName}</span>
                        {item.note ? <span className="block text-xs text-slate-500">{item.note}</span> : null}
                        <label className="motus-meal-entry-grams mt-1 flex flex-wrap items-center gap-1 text-xs text-slate-600">
                          <span className="font-medium">Mengde</span>
                          <TextInput
                            value={String(item.grams)}
                            onChange={(e) =>
                              updateFoodEntryGrams(gridSelection.dayId, gridSelection.mealId, item.id, e.target.value)
                            }
                            inputMode="decimal"
                            className="motus-meal-entry-grams-input !py-1 !text-xs"
                            aria-label={`Gram ${item.foodName}`}
                          />
                          <span>g</span>
                        </label>
                      </span>
                      <button
                        type="button"
                        className="rounded-lg p-1 text-slate-400 hover:bg-white hover:text-red-600"
                        aria-label={`Fjern ${item.foodName}`}
                        onClick={() => removeFoodEntry(gridSelection.dayId, gridSelection.mealId, item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="mt-2 flex flex-wrap gap-2">
                  <OutlineButton onClick={() => openFoodPicker(gridSelection.dayId, gridSelection.mealId)}>
                    <Plus className="h-4 w-4" aria-hidden />
                    Matvare
                  </OutlineButton>
                  <OutlineButton
                    onClick={() => {
                      setRecipePicker(gridSelection);
                      setRecipeSearch("");
                    }}
                  >
                    <Soup className="h-4 w-4" aria-hidden />
                    Oppskrift
                  </OutlineButton>
                  <OutlineButton
                    type="button"
                    onClick={() => openCopyMeal(gridSelection.dayId, selectedGridMeal)}
                    disabled={selectedGridMeal.items.length === 0}
                  >
                    <Copy className="h-4 w-4" aria-hidden />
                    Kopier til dager
                  </OutlineButton>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">Klikk en celle i rutenettet for å redigere måltidet.</p>
            )}

            {activeDay ? (
              <TrainerMealPlanMacroPanel
                dayLabel={activeDay.label}
                dailyTargets={plan.targets}
                dayUsed={dayUsed}
                dayRemaining={dayRemaining}
                onDistribute={handleDistributeMeals}
                onClearMealTargets={handleClearMealTargets}
                adjustmentSuggestions={macroAdjustmentSuggestions}
                onApplySuggestion={applyMacroSuggestion}
              />
            ) : null}
          </section>

          <section className="motus-pt-planner-step">
            <h2 className="motus-pt-planner-step__title">
              <span className="motus-pt-planner-step__num">4</span> Ernæringsoversikt
            </h2>
            <p className="text-xs text-slate-500 mb-2">Gjennomsnitt per dag</p>
            <TrainerMealPlanNutritionOverview averageUsed={weekAverageMacros} targets={plan.targets} />
          </section>

          <section className="motus-pt-planner-step">
            <h2 className="motus-pt-planner-step__title">
              <span className="motus-pt-planner-step__num">5</span> Planinnstillinger
            </h2>
            <div className="grid gap-3">
              <label className="space-y-1 text-xs font-medium text-slate-700">
                <span>Planens navn</span>
                <TextInput value={plan.title} onChange={(e) => updatePlan({ ...plan, title: e.target.value })} />
              </label>
              <label className="space-y-1 text-xs font-medium text-slate-700">
                <span>Notat til klienten</span>
                <TextArea
                  value={plan.notes}
                  onChange={(e) => updatePlan({ ...plan, notes: e.target.value })}
                  className="min-h-[72px]"
                  placeholder="Valgfrie instruksjoner …"
                />
              </label>
              <p className="text-xs text-slate-500">
                Planen deles automatisk med klienten når ernæringstilgang er aktivert.
              </p>
            </div>
          </section>

          <div className="motus-pt-planner-ai-banner">
            <Sparkles className="h-5 w-5 shrink-0" aria-hidden />
            <div className="min-w-0 flex-1">
              <div className="font-bold text-sm">AI-assistent for matplanlegging</div>
              <div className="text-xs opacity-90">Kommer snart — generer hele uken basert på mål og preferanser.</div>
            </div>
            <OutlineButton type="button" className="!border-white/40 !text-white opacity-90" onClick={suggestAiWeekPlan}>
              AI-generer hele uken
            </OutlineButton>
          </div>
        </div>

        <aside className="motus-pt-planner-sidebar">
          <div className="motus-pt-planner-sidebar-card">
            <h3 className="motus-pt-planner-sidebar-title">Klientoversikt</h3>
            <div className="font-bold text-slate-900">{memberName}</div>
            <p className="mt-1 text-sm text-slate-600">{memberGoal.trim() || "Mål ikke angitt"}</p>
            {plan.targets?.kcal ? (
              <ul className="mt-3 space-y-1 text-xs text-slate-600">
                <li>Kalorier: {formatMacro(plan.targets.kcal, 0)}</li>
                <li>Protein: {formatMacro(plan.targets.protein ?? 0, 0)} g</li>
                <li>Karbohydrater: {formatMacro(plan.targets.carbs ?? 0, 0)} g</li>
                <li>Fett: {formatMacro(plan.targets.fat ?? 0, 0)} g</li>
              </ul>
            ) : null}
          </div>
          <div className="motus-pt-planner-sidebar-card">
            <h3 className="motus-pt-planner-sidebar-title">Verktøy</h3>
            <ul className="motus-pt-planner-tools">
              <li>
                <button type="button" className="motus-pt-planner-tool" onClick={suggestAiDayPlan}>
                  <Sparkles className="h-4 w-4" /> AI-generer dag
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className="motus-pt-planner-tool"
                  disabled={!gridSelection}
                  onClick={() => gridSelection && setRecipePicker(gridSelection)}
                >
                  <Soup className="h-4 w-4" /> Bytt måltid
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className="motus-pt-planner-tool"
                  onClick={() => gridSelection && openFoodPicker(gridSelection.dayId, gridSelection.mealId)}
                >
                  <Plus className="h-4 w-4" /> Matvarebank
                </button>
              </li>
              <li>
                <button type="button" className="motus-pt-planner-tool" onClick={handleAutoFillWeek}>
                  <ShoppingCart className="h-4 w-4" /> Forbered handleliste
                </button>
              </li>
            </ul>
          </div>
        </aside>
      </div>

      <details className="rounded-xl border border-slate-200 bg-slate-50/50 p-3">
        <summary className="cursor-pointer text-sm font-semibold text-slate-800">Forhåndsvisning (som medlem)</summary>
        <div className="mt-3">
          <MealPlanDisplay plan={plan} activeDayId={activeDayId} onActiveDayIdChange={setActiveDayId} readOnly />
        </div>
      </details>

      {foodPicker ? (
        <div
          className="motus-foodbank-modal-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setFoodPicker(null);
          }}
        >
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
              {pickerRemaining.hasTargets ? (
                <div
                  className={`motus-pt-food-remaining ${pickerRemaining.kcal < 0 ? "is-over" : ""}`}
                  role="status"
                >
                  <strong>Gjenstår{pickerMeal?.targets ? ` (${pickerMeal.name})` : " (dagen)"}:</strong>{" "}
                  {formatMacro(pickerRemaining.kcal, 0)} kcal · P {formatMacro(pickerRemaining.protein, 0)} · K{" "}
                  {formatMacro(pickerRemaining.carbs, 0)} · F {formatMacro(pickerRemaining.fat, 0)}
                </div>
              ) : null}
              {suggestedFoods.length > 0 ? (
                <div className="motus-pt-suggestions">
                  <p className="motus-pt-suggestions-title">Forslag som passer makroene</p>
                  {suggestedFoods.map(({ food, macros, reason }) => (
                    <button
                      key={food.id}
                      type="button"
                      className="motus-pt-suggestion-row"
                      onClick={() => {
                        selectFoodForPicker(food);
                        addFoodToMeal(food);
                      }}
                    >
                      <span>
                        <span className="font-medium text-slate-800">{food.name}</span>
                        <span className="motus-pt-suggestion-meta">
                          {" "}
                          · {formatMacro(macros.kcal, 0)} kcal · {reason}
                        </span>
                      </span>
                      <span className="text-xs text-teal-700">+</span>
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <OutlineButton
                  type="button"
                  className="text-xs"
                  onClick={() => {
                    if (!foodPicker) return;
                    setRecipePicker(foodPicker);
                    setFoodPicker(null);
                    setRecipeSearch("");
                  }}
                >
                  <Soup className="h-3.5 w-3.5" aria-hidden />
                  Velg oppskrift i stedet
                </OutlineButton>
              </div>
              <label className="motus-foodbank-search">
                <Search className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                <input
                  value={foodSearch}
                  onChange={(e) => setFoodSearch(e.target.value)}
                  placeholder="Søk i matvarebank …"
                  aria-label="Søk matvare"
                />
              </label>
              <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                <p className="text-xs font-medium text-slate-700">
                  {pickerSelectedFood ? (
                    <>
                      Valgt: <strong>{pickerSelectedFood.name}</strong>
                      {pickerSelectedFood.portionLabel ? (
                        <span className="font-normal text-slate-500"> ({pickerSelectedFood.portionLabel})</span>
                      ) : null}
                    </>
                  ) : (
                    "Velg matvare i listen under, juster mengde, og legg til."
                  )}
                </p>
                <label className="space-y-1 text-xs font-medium text-slate-700">
                  <span>Mengde (gram)</span>
                  <TextInput
                    value={foodGrams}
                    onChange={(e) => setFoodGrams(e.target.value)}
                    inputMode="decimal"
                    disabled={!pickerSelectedFood}
                  />
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {[50, 100, 150, 200].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:border-teal-300"
                      disabled={!pickerSelectedFood}
                      onClick={() => setFoodGrams(String(preset))}
                    >
                      {preset} g
                    </button>
                  ))}
                  {pickerSelectedFood?.portionGrams ? (
                    <button
                      type="button"
                      className="rounded-lg border border-teal-200 bg-teal-50 px-2 py-1 text-[11px] font-medium text-teal-800"
                      onClick={() => setFoodGrams(String(pickerSelectedFood.portionGrams))}
                    >
                      Porsjon ({pickerSelectedFood.portionGrams} g)
                    </button>
                  ) : null}
                </div>
                {gramPreview && pickerRemaining.hasTargets ? (
                  <p className="text-[11px] text-slate-600">
                    Etter tillegg ca. <strong>{formatMacro(gramPreview.after.kcal, 0)} kcal</strong> igjen på dagen.
                  </p>
                ) : null}
                <GradientButton type="button" className="w-full" disabled={!pickerSelectedFood} onClick={() => addFoodToMeal()}>
                  <Plus className="h-4 w-4" aria-hidden />
                  Legg til i måltid
                </GradientButton>
              </div>
              <div className="max-h-[40vh] space-y-1 overflow-y-auto">
                {filteredFoods.length === 0 ? (
                  <p className="text-sm text-slate-500">Ingen matvarer funnet. Utvid matvarebanken først.</p>
                ) : (
                  filteredFoods.map((food) => (
                    <button
                      key={food.id}
                      type="button"
                      className={`flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-sm hover:bg-teal-50 ${
                        pickerSelectedFood?.id === food.id
                          ? "border-teal-400 bg-teal-50/80"
                          : "border-slate-100"
                      }`}
                      onClick={() => selectFoodForPicker(food)}
                    >
                      <span className="font-medium text-slate-800">{food.name}</span>
                      <span className="text-xs text-slate-500">
                        {food.portionLabel}
                        {food.portionGrams ? ` · ${food.portionGrams} g` : ""}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {recipePicker ? (
        <div
          className="motus-foodbank-modal-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setRecipePicker(null);
              setRecipePreviewId(null);
            }
          }}
        >
          <div
            className="motus-foodbank-modal motus-foodbank-modal--wide"
            role="dialog"
            aria-label="Velg oppskrift"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="motus-foodbank-modal-head">
              <h3>Velg oppskrift</h3>
              <button
                type="button"
                className="motus-foodbank-icon-btn"
                onClick={() => {
                  setRecipePicker(null);
                  setRecipePreviewId(null);
                }}
                aria-label="Lukk"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="motus-foodbank-modal-body space-y-3">
              <p className="text-xs text-slate-600">
                Oppskrifter fra Ernæring legges inn som 1 porsjon med beregnet makro fra ingredienslisten.
              </p>
              <div className="flex flex-wrap gap-2">
                <OutlineButton
                  type="button"
                  className="text-xs"
                  onClick={() => {
                    setFoodPicker(recipePicker);
                    setRecipePicker(null);
                    setRecipePreviewId(null);
                    setFoodSearch("");
                  }}
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                  Velg matvare i stedet
                </OutlineButton>
              </div>
              <label className="motus-foodbank-search">
                <Search className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                <input
                  value={recipeSearch}
                  onChange={(e) => {
                    setRecipeSearch(e.target.value);
                    setRecipePreviewId(null);
                  }}
                  placeholder="Søk oppskrift …"
                  aria-label="Søk oppskrift"
                />
              </label>
              <div className="motus-recipe-picker-grid">
                <div className="max-h-[min(52vh,28rem)] space-y-1 overflow-y-auto">
                  {recipesLoading ? (
                    <p className="text-sm text-slate-500">Laster oppskrifter …</p>
                  ) : filteredRecipes.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      Ingen oppskrifter funnet. Legg ut oppskrifter under Ernæring først.
                    </p>
                  ) : (
                    filteredRecipes.map((recipe) => {
                      const selected = recipePreviewId === recipe.id;
                      return (
                        <button
                          key={recipe.id}
                          type="button"
                          className={`flex w-full flex-col items-start gap-0.5 rounded-xl border px-3 py-2 text-left text-sm ${
                            selected
                              ? "border-teal-300 bg-teal-50 ring-1 ring-teal-200"
                              : "border-slate-100 hover:bg-teal-50"
                          }`}
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setRecipePreviewId(recipe.id);
                          }}
                        >
                          <span className="font-medium text-slate-800">{recipe.title}</span>
                          <span className="text-xs text-slate-500">{recipe.tag}</span>
                        </button>
                      );
                    })
                  )}
                </div>
                <div className="motus-recipe-picker-preview max-h-[min(52vh,28rem)] overflow-y-auto">
                  {previewRecipe ? (
                    <div className="space-y-3">
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">{previewRecipe.title}</h4>
                        {previewRecipe.description ? (
                          <p className="mt-1 text-xs text-slate-600">{previewRecipe.description}</p>
                        ) : null}
                      </div>
                      <RecipeIngredientList
                        body={previewRecipe.body}
                        foodItems={foodItemsForMacros}
                        dailyTargets={plan?.targets}
                        mealSlot={resolveRecipeMealSlot(
                          previewRecipe.tag,
                          previewRecipe.title,
                          previewRecipe.description,
                        )}
                        scalingMode={resolveRecipeScalingMode({
                          id: previewRecipe.id,
                          scalingMode: previewRecipe.scalingMode,
                          body: previewRecipe.body,
                          title: previewRecipe.title,
                          tag: previewRecipe.tag,
                        })}
                        recipeId={previewRecipe.id}
                      />
                      {previewRecipeAvoidanceConflicts.length > 0 ? (
                        <RecipeAvoidanceWarning
                          conflicts={previewRecipeAvoidanceConflicts}
                          title={`${memberName} unngår ingredienser i denne oppskriften`}
                        />
                      ) : null}
                      {previewRecipeMacros ? <RecipeMacroBlocks result={previewRecipeMacros} /> : null}
                      <GradientButton
                        type="button"
                        className="w-full justify-center text-sm"
                        onClick={() => addRecipeToMeal(previewRecipe.id)}
                      >
                        <Plus className="mr-1.5 h-4 w-4" aria-hidden />
                        Legg til i måltid (1 porsjon)
                      </GradientButton>
                    </div>
                  ) : (
                    <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-3 py-6 text-center text-xs text-slate-500">
                      Velg en oppskrift for å se ingredienser, mengder og bytteforslag før du legger den i matplanen.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {copyMeal && plan ? (
        <div
          className="motus-foodbank-modal-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setCopyMeal(null);
          }}
        >
          <div
            className="motus-foodbank-modal"
            role="dialog"
            aria-label="Kopier måltid"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="motus-foodbank-modal-head">
              <h3>Kopier «{copyMeal.mealName}»</h3>
              <button type="button" className="motus-foodbank-icon-btn" onClick={() => setCopyMeal(null)} aria-label="Lukk">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="motus-foodbank-modal-body space-y-3">
              <p className="text-sm text-slate-600">
                Matvarer legges til samme måltid (frokost/lunsj osv.) på valgte dager. Eksisterende mat beholdes.
              </p>
              <div className="motus-pt-copy-days">
                {plan.days
                  .filter((d) => d.id !== copyMeal.dayId)
                  .map((day) => (
                    <label key={day.id} className="motus-pt-copy-day-check">
                      <input
                        type="checkbox"
                        checked={copyTargetDayIds.includes(day.id)}
                        onChange={(e) =>
                          setCopyTargetDayIds((current) =>
                            e.target.checked ? [...current, day.id] : current.filter((id) => id !== day.id),
                          )
                        }
                      />
                      {day.label}
                    </label>
                  ))}
              </div>
            </div>
            <div className="motus-foodbank-modal-actions">
              <OutlineButton type="button" onClick={() => setCopyMeal(null)}>
                Avbryt
              </OutlineButton>
              <GradientButton type="button" onClick={handleConfirmCopyMeal}>
                Kopier
              </GradientButton>
            </div>
          </div>
        </div>
      ) : null}

      {previewMeal ? (
        <div
          className="motus-foodbank-modal-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setPreviewSelection(null);
          }}
        >
          <div
            className="motus-foodbank-modal"
            role="dialog"
            aria-label="Se måltidsinnhold"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="motus-foodbank-modal-head">
              <h3>
                {previewMeal.meal.name} · {previewMeal.day.label}
              </h3>
              <button
                type="button"
                className="motus-foodbank-icon-btn"
                onClick={() => setPreviewSelection(null)}
                aria-label="Lukk"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="motus-foodbank-modal-body space-y-3">
              <p className="text-xs text-slate-600">
                {previewMeal.meal.items.length
                  ? `Innhold: ${previewMeal.meal.items.length} matvare(r) · ${formatMacroTotals(
                      computeMealMacros(previewMeal.meal, foodById),
                    )}`
                  : "Ingen matvarer i dette måltidet enda."}
              </p>
              {previewMeal.meal.items.length > 0 ? (
                <ul className="space-y-2">
                  {previewMeal.meal.items.map((item) => {
                    const recipeId = parseInspirationRecipeFoodId(item.foodId);
                    const hasRecipe = Boolean(recipeId && recipesById.has(recipeId));
                    return (
                      <li
                        key={item.id}
                        className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-slate-900">{item.foodName}</div>
                          <div className="text-xs text-slate-600">
                            {formatMacro(item.grams, 0)} g{item.note ? ` · ${item.note}` : ""}
                          </div>
                        </div>
                        {hasRecipe && recipeId ? (
                          <OutlineButton type="button" className="text-xs" onClick={() => setRecipeReadOnlyId(recipeId)}>
                            Se oppskrift
                          </OutlineButton>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {recipeReadOnly ? (
        <div
          className="motus-foodbank-modal-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setRecipeReadOnlyId(null);
          }}
        >
          <div
            className="motus-foodbank-modal motus-foodbank-modal--wide"
            role="dialog"
            aria-label="Se oppskrift"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="motus-foodbank-modal-head">
              <h3>{recipeReadOnly.title}</h3>
              <button
                type="button"
                className="motus-foodbank-icon-btn"
                onClick={() => setRecipeReadOnlyId(null)}
                aria-label="Lukk"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="motus-foodbank-modal-body space-y-3">
              {recipeReadOnly.description ? <p className="text-sm text-slate-600">{recipeReadOnly.description}</p> : null}
              <RecipeIngredientList body={recipeReadOnly.body} foodItems={foodItemsForMacros} recipeId={recipeReadOnly.id} />
              {computeRecipeMacros(recipeReadOnly.body, foodItemsForMacros) ? (
                <RecipeMacroBlocks result={computeRecipeMacros(recipeReadOnly.body, foodItemsForMacros)!} />
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
