import { useMemo, useState } from "react";
import { ArrowLeft, Copy, Pencil, Soup } from "lucide-react";
import { buildDefaultFoodBankItems } from "../../app/foodBankSeed";
import type { MealPlanTargets } from "../../app/mealPlanTypes";
import { buildScaledRecipeView, resolveRecipeScalingMode } from "../../app/recipeMealScaling";
import { computeRecipeMacros, extractRecipeIngredientLines } from "../../app/recipeMacros";
import {
  RECIPE_MEAL_SLOTS,
  resolveRecipeMealSlot,
  type RecipeMealSlot,
} from "../../app/recipeMealCategory";
import {
  RECIPE_PROTEIN_CATEGORY_FILTERS,
  recipeProteinCategoryLabel,
  resolveRecipeProteinCategory,
  type RecipeProteinCategoryFilter,
} from "../../app/recipeProteinCategory";
import { useInspirationRecipeItems, type InspirationRecipeItem } from "../../app/inspirationRecipeItems";
import { useFoodBankItems } from "../../app/useFoodBankItems";
import { RecipeIngredientList } from "../../components/RecipeIngredientList";
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

function RecipeDetail({
  item,
  onBack,
  dailyTargets,
  canManage,
  onEdit,
  onDuplicate,
}: {
  item: InspirationRecipeItem;
  onBack: () => void;
  dailyTargets?: MealPlanTargets;
  canManage?: boolean;
  onEdit?: (item: InspirationRecipeItem) => void;
  onDuplicate?: (item: InspirationRecipeItem) => void;
}) {
  const foodItems = useFoodItemsForMacros();
  const mealSlot = resolveRecipeMealSlot(item.tag, item.title, item.description);
  const proteinCategory = resolveRecipeProteinCategory(item);
  const scalingMode = resolveRecipeScalingMode({
    id: item.id,
    scalingMode: item.scalingMode,
    body: item.body,
    title: item.title,
    tag: item.tag,
  });
  const scaledView = useMemo(
    () =>
      buildScaledRecipeView(item.body, foodItems, {
        scalingMode,
        dailyTargets,
        mealSlot,
      }),
    [item.body, foodItems, scalingMode, dailyTargets, mealSlot],
  );
  const macros = scaledView?.macros ?? computeRecipeMacros(item.body, foodItems);
  const hasIngredientSection = useMemo(() => extractRecipeIngredientLines(item.body).length > 0, [item.body]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <OutlineButton type="button" onClick={onBack} className="text-sm">
          <ArrowLeft className="mr-1.5 inline h-4 w-4" aria-hidden />
          Tilbake til oppskrifter
        </OutlineButton>
        {canManage && onEdit ? (
          <OutlineButton type="button" className="text-sm" onClick={() => onEdit(item)}>
            <Pencil className="mr-1.5 inline h-4 w-4" aria-hidden />
            Rediger oppskrift
          </OutlineButton>
        ) : null}
        {canManage && onDuplicate ? (
          <OutlineButton type="button" className="text-sm" onClick={() => onDuplicate(item)}>
            <Copy className="mr-1.5 inline h-4 w-4" aria-hidden />
            Dupliser oppskrift
          </OutlineButton>
        ) : null}
      </div>
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
            {mealSlot === "lunsj" || mealSlot === "middag" ? (
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                {recipeProteinCategoryLabel(proteinCategory) || "Uten type"}
              </span>
            ) : null}
          </div>
          <h2 className="mt-3 text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">{item.title}</h2>
          {item.description ? <p className="mt-2 text-sm text-slate-600 sm:text-base">{item.description}</p> : null}
          <RecipeIngredientList
            body={item.body}
            foodItems={foodItems}
            dailyTargets={dailyTargets}
            mealSlot={mealSlot}
            scalingMode={scalingMode}
            recipeId={item.id}
          />
          {item.body.trim() ? (
            <details className="mt-4 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2">
              <summary className="cursor-pointer text-xs font-semibold text-slate-600">Vis full oppskriftstekst</summary>
              <div className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{item.body}</div>
            </details>
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
  adjusted,
  onSelect,
  canManage,
  onEdit,
  onDuplicate,
}: {
  item: InspirationRecipeItem;
  macros: ReturnType<typeof computeRecipeMacros>;
  adjusted?: boolean;
  onSelect: () => void;
  canManage?: boolean;
  onEdit?: (item: InspirationRecipeItem) => void;
  onDuplicate?: (item: InspirationRecipeItem) => void;
}) {
  const mealSlot = resolveRecipeMealSlot(item.tag, item.title, item.description);
  const proteinCategory = resolveRecipeProteinCategory(item);

  return (
    <article
      className="flex h-full w-full flex-col overflow-hidden rounded-2xl border bg-white text-left shadow-sm transition hover:border-teal-200 hover:shadow-md"
      style={{ borderColor: "rgba(15,23,42,0.08)" }}
    >
      <button type="button" onClick={onSelect} className="flex flex-1 flex-col text-left">
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
          {(mealSlot === "lunsj" || mealSlot === "middag") && proteinCategory ? (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
              {recipeProteinCategoryLabel(proteinCategory)}
            </span>
          ) : null}
        </div>
        <span className="mt-1 line-clamp-2 text-sm font-semibold text-slate-900">{item.title}</span>
        {item.description ? (
          <span className="mt-1 line-clamp-2 text-xs text-slate-500 sm:text-sm">{item.description}</span>
        ) : null}
        {macros ? (
          <RecipeMacroSummary
            result={macros}
            compact
            hint={adjusted ? "Tilpasset ditt måltidsmål" : undefined}
          />
        ) : null}
      </div>
      </button>
      {canManage && onEdit ? (
        <div className="border-t px-3 py-2" style={{ borderColor: "rgba(15,23,42,0.06)" }}>
          <div className="flex gap-1.5">
            <button
              type="button"
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-white"
              onClick={(event) => {
                event.stopPropagation();
                onEdit(item);
              }}
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden />
              Rediger
            </button>
            {onDuplicate ? (
              <button
                type="button"
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-white"
                onClick={(event) => {
                  event.stopPropagation();
                  onDuplicate(item);
                }}
              >
                <Copy className="h-3.5 w-3.5" aria-hidden />
                Dupliser
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </article>
  );
}

type NutritionRecipesPanelProps = {
  mealPlanTargets?: MealPlanTargets;
  canManage?: boolean;
  onEdit?: (item: InspirationRecipeItem) => void;
  onDuplicate?: (item: InspirationRecipeItem) => void;
};

export function NutritionRecipesPanel({ mealPlanTargets, canManage, onEdit, onDuplicate }: NutritionRecipesPanelProps) {
  const { items, loading } = useInspirationRecipeItems();
  const foodItems = useFoodItemsForMacros();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mealTab, setMealTab] = useState<RecipeMealSlot>("frokost");
  const [proteinFilter, setProteinFilter] = useState<RecipeProteinCategoryFilter>("all");

  const scaledById = useMemo(() => {
    const map = new Map<
      string,
      { macros: ReturnType<typeof computeRecipeMacros>; adjusted: boolean }
    >();
    for (const item of items) {
      const mealSlot = resolveRecipeMealSlot(item.tag, item.title, item.description);
      const scalingMode = resolveRecipeScalingMode({
        id: item.id,
        scalingMode: item.scalingMode,
        body: item.body,
        title: item.title,
        tag: item.tag,
      });
      const view = buildScaledRecipeView(item.body, foodItems, {
        scalingMode,
        dailyTargets: mealPlanTargets,
        mealSlot,
      });
      const macros = view?.macros ?? computeRecipeMacros(item.body, foodItems);
      map.set(item.id, { macros, adjusted: view?.adjusted ?? false });
    }
    return map;
  }, [items, foodItems, mealPlanTargets]);

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
  const supportsProteinFilter = mealTab === "lunsj" || mealTab === "middag";
  const mealItems = itemsByMeal.get(mealTab) ?? [];
  const proteinCounts = useMemo(() => {
    const counts = new Map<RecipeProteinCategoryFilter, number>([["all", mealItems.length]]);
    for (const item of mealItems) {
      const category = resolveRecipeProteinCategory(item);
      if (category) counts.set(category, (counts.get(category) ?? 0) + 1);
    }
    return counts;
  }, [mealItems]);
  const visibleItems =
    supportsProteinFilter && proteinFilter !== "all"
      ? mealItems.filter((item) => resolveRecipeProteinCategory(item) === proteinFilter)
      : mealItems;

  if (loading) {
    return <Card className="p-6 text-center text-sm text-slate-600">Laster oppskrifter …</Card>;
  }

  if (selected) {
    return (
      <RecipeDetail
        item={selected}
        onBack={() => setSelectedId(null)}
        dailyTargets={mealPlanTargets}
        canManage={canManage}
        onEdit={onEdit}
        onDuplicate={onDuplicate}
      />
    );
  }

  if (!items.length) {
    return (
      <EmptyState
        icon="🥗"
        title="Ingen oppskrifter ennå"
        description="Treneren legger ut oppskrifter under Ernæring. De vises her når de er publisert."
        className="bg-white"
      />
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Oppskrifter med makronæringsstoffer per porsjon.{" "}
        {mealPlanTargets?.kcal ? (
          <>
            Fleksible middager tilpasses ca. måltidsmålet fra matplanen din ({Math.round(mealPlanTargets.kcal)} kcal/dag).
            Faste oppskrifter (f.eks. brødskive, batch-retter) beholder opprinnelige mengder.
          </>
        ) : (
          <>
            Når du har matplan med kalorimål, tilpasses enkle middager automatisk — oppskrifter med faste mengder
            endres ikke.
          </>
        )}
      </p>
      <div className="flex flex-wrap gap-2">
        {RECIPE_MEAL_SLOTS.map((slot) => {
          const count = itemsByMeal.get(slot.id)?.length ?? 0;
          return (
            <PillButton
              key={slot.id}
              active={mealTab === slot.id}
              onClick={() => {
                setMealTab(slot.id);
                setProteinFilter("all");
              }}
            >
              {slot.label}
              {count > 0 ? ` (${count})` : ""}
            </PillButton>
          );
        })}
      </div>
      {supportsProteinFilter ? (
        <div className="flex flex-wrap gap-2">
          {RECIPE_PROTEIN_CATEGORY_FILTERS.map((filter) => {
            const count = proteinCounts.get(filter.id) ?? 0;
            return (
              <PillButton
                key={filter.id}
                active={proteinFilter === filter.id}
                onClick={() => setProteinFilter(filter.id)}
              >
                {filter.label}
                {count > 0 ? ` (${count})` : ""}
              </PillButton>
            );
          })}
        </div>
      ) : null}
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
              <RecipeCard
                item={item}
                macros={scaledById.get(item.id)?.macros ?? null}
                adjusted={scaledById.get(item.id)?.adjusted}
                onSelect={() => setSelectedId(item.id)}
                canManage={canManage}
                onEdit={onEdit}
                onDuplicate={onDuplicate}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
