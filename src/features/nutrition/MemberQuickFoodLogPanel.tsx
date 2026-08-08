import { useCallback, useEffect, useMemo, useState } from "react";
import { Sparkles, Trash2 } from "lucide-react";
import { defaultPortionGramsForFood } from "../../app/foodPortionDefaults";
import { formatMacro, type FoodItem } from "../../app/foodBankTypes";
import { toIsoDateKey, type MemberQuickFoodLogEntry } from "../../app/memberMealPlanState";
import { loadMemberMealPlanState } from "../../app/memberMealPlanState";
import { persistMemberMealPlanStateLocalAndScheduleCloud, syncMemberMealPlanState } from "../../app/memberMealPlanStateCloud";
import { useFoodBankItems } from "../../app/useFoodBankItems";
import { useInspirationRecipeItems } from "../../app/inspirationRecipeItems";
import { computeRecipeMacros } from "../../app/recipeMacros";
import { Card, OutlineButton, TextInput } from "../../app/ui";

type MemberQuickFoodLogPanelProps = {
  memberId: string;
  readOnly?: boolean;
  onRefreshFoodBank?: () => void;
};

function todayKey(): string {
  return toIsoDateKey(new Date());
}

export function MemberQuickFoodLogPanel({ memberId, readOnly = false, onRefreshFoodBank }: MemberQuickFoodLogPanelProps) {
  const foodItems = useFoodBankItems();
  const { items: recipes } = useInspirationRecipeItems();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [state, setState] = useState(() => loadMemberMealPlanState(memberId));
  const [selectedFoodId, setSelectedFoodId] = useState("");
  const [gramsInput, setGramsInput] = useState("100");

  const key = todayKey();
  const logs = state.quickFoodLogs[key] ?? [];

  useEffect(() => {
    onRefreshFoodBank?.();
  }, [onRefreshFoodBank]);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      const synced = await syncMemberMealPlanState(memberId);
      if (mounted) setState(synced);
    })();
    return () => {
      mounted = false;
    };
  }, [memberId]);

  const filteredFoods = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matches = (item: FoodItem) => {
      const haystack = `${item.name} ${item.origin}`.toLowerCase();
      return !q || haystack.includes(q);
    };
    const matched = q ? foodItems.filter(matches) : foodItems;
    return matched.slice(0, 25);
  }, [foodItems, search]);

  const selectedFood = useMemo(
    () => foodItems.find((item) => item.id === selectedFoodId) ?? null,
    [foodItems, selectedFoodId],
  );

  useEffect(() => {
    if (!selectedFood) return;
    setGramsInput(String(defaultPortionGramsForFood(selectedFood)));
  }, [selectedFood]);

  const persist = useCallback(
    (nextLogs: MemberQuickFoodLogEntry[]) => {
      const nextState = {
        ...state,
        quickFoodLogs: {
          ...state.quickFoodLogs,
          [key]: nextLogs,
        },
        updatedAt: new Date().toISOString(),
      };
      setState(nextState);
      persistMemberMealPlanStateLocalAndScheduleCloud(memberId, nextState);
    },
    [key, memberId, state],
  );

  const addFood = useCallback(() => {
    if (!selectedFood) return;
    const grams = Number(gramsInput.replace(",", "."));
    if (!Number.isFinite(grams) || grams <= 0) {
      setStatus("Skriv inn gyldig gram.");
      return;
    }
    const entry: MemberQuickFoodLogEntry = {
      id: `log-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      name: selectedFood.name,
      grams: Math.round(grams),
      source: "food",
      loggedAt: new Date().toISOString(),
      nutritionPer100g: { ...selectedFood.nutritionPer100g },
    };
    persist([entry, ...logs]);
    setStatus(`${selectedFood.name} logget.`);
  }, [gramsInput, logs, persist, selectedFood]);

  const addRecipe = useCallback(
    (source: "recipe" | "ai") => {
      const pool = recipes.filter((recipe) =>
        Boolean(
          computeRecipeMacros(recipe.body, foodItems, {
            servings: recipe.servings,
            ingredientFoodOverrides: recipe.ingredientFoodOverrides,
          }),
        ),
      );
      if (!pool.length) {
        setStatus("Fant ingen oppskrifter med beregnede makroer.");
        return;
      }
      const picked = source === "ai" ? pool[Math.floor(Math.random() * pool.length)] : pool[0];
      const macros = computeRecipeMacros(picked.body, foodItems, {
        servings: picked.servings,
        ingredientFoodOverrides: picked.ingredientFoodOverrides,
      });
      if (!macros) return;
      const entry: MemberQuickFoodLogEntry = {
        id: `log-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
        name: picked.title,
        grams: 100,
        source,
        loggedAt: new Date().toISOString(),
        nutritionPer100g: {
          kcal: Math.round(macros.perServing.kcal),
          protein: Math.round(macros.perServing.protein * 10) / 10,
          carbs: Math.round(macros.perServing.carbs * 10) / 10,
          fat: Math.round(macros.perServing.fat * 10) / 10,
          fiber: 0,
          sugar: 0,
          saturatedFat: 0,
          sodium: 0,
          micronutrients: { ...macros.perServingMicronutrients },
        },
      };
      persist([entry, ...logs]);
      setStatus(source === "ai" ? `AI la til ${picked.title}.` : `${picked.title} logget.`);
    },
    [foodItems, logs, persist, recipes],
  );

  const removeLog = useCallback(
    (entryId: string) => {
      const next = logs.filter((entry) => entry.id !== entryId);
      persist(next);
    },
    [logs, persist],
  );

  return (
    <Card className="p-4 space-y-3">
      <h3 className="text-sm font-semibold text-slate-900">Logg mat uten plan</h3>
      {!readOnly ? (
        <>
          <TextInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Søk enkeltvare…" />
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_110px_auto]">
            <select
              value={selectedFoodId}
              onChange={(e) => setSelectedFoodId(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="">Velg matvare</option>
              {filteredFoods.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({defaultPortionGramsForFood(item)} g)
                </option>
              ))}
            </select>
            <TextInput value={gramsInput} onChange={(e) => setGramsInput(e.target.value)} inputMode="decimal" placeholder="Gram" />
            <OutlineButton type="button" onClick={addFood}>
              Logg
            </OutlineButton>
          </div>
          <div className="flex flex-wrap gap-2">
            <OutlineButton type="button" onClick={() => addRecipe("recipe")}>
              Logg oppskrift
            </OutlineButton>
            <OutlineButton type="button" onClick={() => addRecipe("ai")}>
              <Sparkles className="h-4 w-4" aria-hidden />
              AI-forslag
            </OutlineButton>
          </div>
        </>
      ) : null}
      {status ? <p className="text-xs text-teal-700">{status}</p> : null}
      <ul className="space-y-2">
        {logs.length === 0 ? (
          <li className="text-sm text-slate-500">Ingen logger i dag ennå.</li>
        ) : (
          logs.map((entry) => (
            <li key={entry.id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50 p-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-800">
                  {entry.name} · {formatMacro(entry.grams, 0)} g
                </p>
                <p className="text-xs text-slate-500">
                  {formatMacro((entry.nutritionPer100g.kcal * entry.grams) / 100, 0)} kcal · P{" "}
                  {formatMacro((entry.nutritionPer100g.protein * entry.grams) / 100, 1)} · K{" "}
                  {formatMacro((entry.nutritionPer100g.carbs * entry.grams) / 100, 1)} · F{" "}
                  {formatMacro((entry.nutritionPer100g.fat * entry.grams) / 100, 1)}
                </p>
              </div>
              {!readOnly ? (
                <button
                  type="button"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50"
                  onClick={() => removeLog(entry.id)}
                  aria-label={`Fjern ${entry.name}`}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </button>
              ) : null}
            </li>
          ))
        )}
      </ul>
    </Card>
  );
}
