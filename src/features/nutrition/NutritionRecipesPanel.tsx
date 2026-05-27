import { useMemo, useState } from "react";
import { ArrowLeft, Soup } from "lucide-react";
import { buildDefaultFoodBankItems } from "../../app/foodBankSeed";
import { computeRecipeMacros, extractRecipeIngredientLines } from "../../app/recipeMacros";
import {
  RECIPE_MEAL_SLOTS,
  resolveRecipeMealSlot,
  type RecipeMealSlot,
} from "../../app/recipeMealCategory";
import { useInspirationRecipeItems, type InspirationRecipeItem } from "../../app/inspirationRecipeItems";
import { useFoodBankItems } from "../../app/useFoodBankItems";
import { RecipeMacroBlocks } from "../../components/RecipeMacroBlocks";
import { RecipeMacroSummary } from "../../components/RecipeMacroSummary";
import { Card, EmptyState, OutlineButton, PillButton } from "../../app/ui";
import "../../foodbank.css";

function useFoodItemsForMacros() {
  const foodItems = useFoodBankItems();
  return useMemo(
    () => (foodItems.length > 0 ? foodItems : buildDefaultFoodBankItems()),
    [foodItems],
  );
}

function RecipeDetail({ item, onBack }: { item: InspirationRecipeItem; onBack: () => void }) {
  const foodItems = useFoodItemsForMacros();
  const macros = useMemo(() => computeRecipeMacros(item.body, foodItems), [item.body, foodItems]);
  const hasIngredientSection = useMemo(() => extractRecipeIngredientLines(item.body).length > 0, [item.body]);
  const mealSlot = resolveRecipeMealSlot(item.tag, item.title, item.description);

  return (
    <div className="space-y-4">
      <OutlineButton type="button" onClick={onBack} className="text-sm">
        <ArrowLeft className="mr-1.5 inline h-4 w-4" aria-hidden />
        Tilbake til oppskrifter
      </OutlineButton>
      <article className="overflow-hidden rounded-2xl border bg-white shadow-sm" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
        {item.imageUrl ? (
          <div className="aspect-[16/10] w-full overflow-hidden bg-slate-100">
            <img src={item.imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
          </div>
        ) : (
          <div className="flex aspect-[16/10] items-center justify-center bg-teal-50">
            <Soup className="h-14 w-14 text-teal-600/60" aria-hidden />
          </div>
        )}
        <div className="p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            {mealSlot ? (
              <span className="rounded-full bg-teal-700 px-2.5 py-1 text-[11px] font-semibold text-white">
                {RECIPE_MEAL_SLOTS.find((row) => row.id === mealSlot)?.label}
              </span>
            ) : null}
            <span className="rounded-full bg-teal-50 px-2.5 py-1 text-[11px] font-semibold text-teal-800 ring-1 ring-teal-100">
              {item.tag}
            </span>
          </div>
          <h2 className="mt-3 text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">{item.title}</h2>
          {item.description ? <p className="mt-2 text-sm text-slate-600 sm:text-base">{item.description}</p> : null}
          {item.body.trim() ? (
            <div className="mt-5 whitespace-pre-wrap text-sm leading-relaxed text-slate-700 sm:text-base">{item.body}</div>
          ) : null}
          {macros ? (
            <div className="mt-6">
              <RecipeMacroBlocks result={macros} />
            </div>
          ) : hasIngredientSection ? (
            <p className="mt-6 rounded-xl border border-amber-100 bg-amber-50/80 px-3 py-2 text-xs text-amber-900">
              Kunne ikke beregne makroer for alle ingredienser. Sjekk at oppskriften bruker mengder (f.eks. dl, g, ss) og at
              ingrediensene finnes i matvarebanken.
            </p>
          ) : null}
        </div>
      </article>
    </div>
  );
}

function RecipeCard({
  item,
  macros,
  onSelect,
}: {
  item: InspirationRecipeItem;
  macros: ReturnType<typeof computeRecipeMacros>;
  onSelect: () => void;
}) {
  const mealSlot = resolveRecipeMealSlot(item.tag, item.title, item.description);

  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex h-full w-full flex-col overflow-hidden rounded-2xl border bg-white text-left shadow-sm transition hover:border-teal-200 hover:shadow-md"
      style={{ borderColor: "rgba(15,23,42,0.08)" }}
    >
      {item.imageUrl ? (
        <div className="aspect-[16/10] w-full overflow-hidden bg-slate-100">
          <img src={item.imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
        </div>
      ) : (
        <div className="flex aspect-[16/10] items-center justify-center bg-gradient-to-br from-teal-50 to-white">
          <Soup className="h-10 w-10 text-teal-600/50" aria-hidden />
        </div>
      )}
      <div className="flex flex-1 flex-col p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {mealSlot ? (
            <span className="rounded-full bg-teal-700/90 px-2 py-0.5 text-[10px] font-semibold text-white">
              {RECIPE_MEAL_SLOTS.find((row) => row.id === mealSlot)?.label}
            </span>
          ) : null}
          <span className="text-[11px] font-semibold uppercase tracking-wide text-teal-700">{item.tag}</span>
        </div>
        <span className="mt-1 line-clamp-2 text-sm font-semibold text-slate-900">{item.title}</span>
        {item.description ? (
          <span className="mt-1 line-clamp-2 text-xs text-slate-500 sm:text-sm">{item.description}</span>
        ) : null}
        {macros ? <RecipeMacroSummary result={macros} compact /> : null}
      </div>
    </button>
  );
}

export function NutritionRecipesPanel() {
  const { items, loading } = useInspirationRecipeItems();
  const foodItems = useFoodItemsForMacros();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mealTab, setMealTab] = useState<RecipeMealSlot>("frokost");

  const macrosById = useMemo(() => {
    const map = new Map<string, ReturnType<typeof computeRecipeMacros>>();
    for (const item of items) {
      map.set(item.id, computeRecipeMacros(item.body, foodItems));
    }
    return map;
  }, [items, foodItems]);

  const itemsByMeal = useMemo(() => {
    const grouped = new Map<RecipeMealSlot, InspirationRecipeItem[]>(
      RECIPE_MEAL_SLOTS.map((slot) => [slot.id, []]),
    );
    for (const item of items) {
      const slot = resolveRecipeMealSlot(item.tag, item.title, item.description);
      if (slot) grouped.get(slot)?.push(item);
    }
    for (const list of grouped.values()) {
      list.sort((a, b) => a.title.localeCompare(b.title, "no"));
    }
    return grouped;
  }, [items]);

  const selected = items.find((item) => item.id === selectedId) ?? null;
  const visibleItems = itemsByMeal.get(mealTab) ?? [];

  if (loading) {
    return <Card className="p-6 text-center text-sm text-slate-600">Laster oppskrifter …</Card>;
  }

  if (selected) {
    return <RecipeDetail item={selected} onBack={() => setSelectedId(null)} />;
  }

  if (!items.length) {
    return (
      <EmptyState
        icon="🥗"
        title="Ingen oppskrifter ennå"
        description="Oppskrifter fra Utforsk vises her når PT har lagt dem ut."
        className="bg-white"
      />
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Oppskrifter fra Motus med makronæringsstoffer per porsjon der ingredienslisten er strukturert med{" "}
        <strong className="font-semibold text-slate-700">Ingredienser</strong>.
      </p>
      <div className="flex flex-wrap gap-2">
        {RECIPE_MEAL_SLOTS.map((slot) => {
          const count = itemsByMeal.get(slot.id)?.length ?? 0;
          return (
            <PillButton key={slot.id} active={mealTab === slot.id} onClick={() => setMealTab(slot.id)}>
              {slot.label}
              {count > 0 ? ` (${count})` : ""}
            </PillButton>
          );
        })}
      </div>
      {visibleItems.length === 0 ? (
        <EmptyState
          icon="🍽️"
          title={`Ingen ${RECIPE_MEAL_SLOTS.find((s) => s.id === mealTab)?.label?.toLowerCase() ?? "oppskrifter"}`}
          description="Velg en annen kategori, eller be PT merke oppskrifter med f.eks. «Frokost» i taggen."
          className="bg-white"
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {visibleItems.map((item) => (
            <li key={item.id}>
              <RecipeCard item={item} macros={macrosById.get(item.id) ?? null} onSelect={() => setSelectedId(item.id)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
