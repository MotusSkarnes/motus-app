import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Copy, Pencil, Trash2, UtensilsCrossed } from "lucide-react";
import { buildDefaultFoodBankItems } from "../../app/foodBankSeed";
import type { MealPlanTargets } from "../../app/mealPlanTypes";
import { parseRecipeBaseServings } from "../../app/recipeBody";
import { buildScaledRecipeView, resolveRecipeScalingMode } from "../../app/recipeMealScaling";
import { computeRecipeMacros } from "../../app/recipeMacros";
import {
  RECIPE_MEAL_SLOTS,
  mealSlotLabel,
  recipeMealSlotFor,
  recipeMealSlotsFor,
  type RecipeMealListTab,
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
import { RecipeCookPanel } from "../../components/RecipeCookPanel";
import { RecipeMacroSummary } from "../../components/RecipeMacroSummary";
import { RecipePhoto } from "../../components/RecipePhoto";
import { Card, EmptyState, GradientButton, OutlineButton, PillButton } from "../../app/ui";
import { buildRecipeMealDraftItems, memberMealSlotIdFromRecipe } from "../../app/recipeMealDraft";
import { memberMealSlotLabel } from "../../app/memberMealSlots";
import type { MealDraftItem } from "../../app/mealDraft";
import { LogRecipeAsMealModal } from "./LogRecipeAsMealModal";
import "../../foodbank.css";

type RecipePanelTab = RecipeMealListTab | "unavailable";

function useFoodItemsForMacros() {
  const foodItems = useFoodBankItems();
  return useMemo(
    () => (foodItems.length > 0 ? foodItems : buildDefaultFoodBankItems()),
    [foodItems],
  );
}

function recipeShowsProteinType(slots: RecipeMealSlot[]): boolean {
  return slots.includes("lunsj") || slots.includes("middag");
}

function RecipeMealBadges({ slots }: { slots: RecipeMealSlot[] }) {
  if (!slots.length) return null;
  return (
    <>
      {slots.map((slot) => (
        <span key={slot} className="rounded-full bg-teal-700 px-2.5 py-1 text-[11px] font-semibold text-white">
          {mealSlotLabel(slot)}
        </span>
      ))}
    </>
  );
}

function RecipeDetail({
  item,
  onBack,
  dailyTargets,
  canManage,
  onEdit,
  onDuplicate,
  onDelete,
  preferredMealSlot,
  memberId,
}: {
  item: InspirationRecipeItem;
  onBack: () => void;
  dailyTargets?: MealPlanTargets;
  canManage?: boolean;
  onEdit?: (item: InspirationRecipeItem) => void;
  onDuplicate?: (item: InspirationRecipeItem) => void;
  onDelete?: (item: InspirationRecipeItem) => void;
  preferredMealSlot?: RecipeMealSlot | null;
  memberId?: string;
}) {
  const foodItems = useFoodItemsForMacros();
  const mealSlots = recipeMealSlotsFor(item);
  const mealSlot = recipeMealSlotFor(item, preferredMealSlot);
  const proteinCategory = resolveRecipeProteinCategory(item);
  const baseServings = parseRecipeBaseServings(item.body, item.servings);
  const [viewServings, setViewServings] = useState(baseServings);
  const [logOpen, setLogOpen] = useState(false);
  const [logDraft, setLogDraft] = useState<MealDraftItem[]>([]);
  const [logStatus, setLogStatus] = useState<string | null>(null);

  useEffect(() => {
    setViewServings(baseServings);
    setLogOpen(false);
  }, [item.id, baseServings]);

  const canLogAsMeal = Boolean(memberId?.trim());

  function openLogAsMeal() {
    setLogDraft(buildRecipeMealDraftItems(item, foodItems, { viewServings, mealSlot }));
    setLogOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <OutlineButton type="button" onClick={onBack} className="text-sm">
          <ArrowLeft className="mr-1.5 inline h-4 w-4" aria-hidden />
          Tilbake til måltider
        </OutlineButton>
        {canManage && onEdit ? (
          <OutlineButton type="button" className="text-sm" onClick={() => onEdit(item)}>
            <Pencil className="mr-1.5 inline h-4 w-4" aria-hidden />
            Rediger måltid
          </OutlineButton>
        ) : null}
        {canManage && onDuplicate ? (
          <OutlineButton type="button" className="text-sm" onClick={() => onDuplicate(item)}>
            <Copy className="mr-1.5 inline h-4 w-4" aria-hidden />
            Dupliser måltid
          </OutlineButton>
        ) : null}
        {canManage && onDelete ? (
          <OutlineButton type="button" className="text-sm text-rose-700" onClick={() => onDelete(item)}>
            <Trash2 className="mr-1.5 inline h-4 w-4" aria-hidden />
            Slett måltid
          </OutlineButton>
        ) : null}
      </div>
      <article className="overflow-hidden rounded-2xl border bg-white shadow-sm" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
        <RecipePhoto src={item.imageUrl} size="hero" alt="" />
        <div className="p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            <RecipeMealBadges slots={mealSlots} />
            <span className="rounded-full bg-teal-50 px-2.5 py-1 text-[11px] font-semibold text-teal-800 ring-1 ring-teal-100">
              {item.tag}
            </span>
            {recipeShowsProteinType(mealSlots) ? (
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                {recipeProteinCategoryLabel(proteinCategory) || "Uten type"}
              </span>
            ) : null}
          </div>
          <h2 className="mt-3 text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">{item.title}</h2>
          {item.description ? <p className="mt-2 text-sm text-slate-600 sm:text-base">{item.description}</p> : null}
          {canLogAsMeal ? (
            <div className="mt-4">
              <GradientButton type="button" className="w-full sm:w-auto" onClick={openLogAsMeal}>
                <UtensilsCrossed className="mr-1.5 h-4 w-4" aria-hidden />
                Logg som måltid
              </GradientButton>
              {logStatus ? <p className="mt-2 text-sm font-medium text-slate-600">{logStatus}</p> : null}
            </div>
          ) : null}
          <div className="mt-4">
            <RecipeCookPanel
              item={item}
              foodItems={foodItems}
              dailyTargets={dailyTargets}
              mealSlot={mealSlot}
              viewServings={viewServings}
              onViewServingsChange={setViewServings}
            />
          </div>
        </div>
      </article>
      {canLogAsMeal && logOpen && memberId ? (
        <LogRecipeAsMealModal
          open
          memberId={memberId}
          recipeTitle={item.title}
          initialDraftItems={logDraft}
          defaultMealSlotId={memberMealSlotIdFromRecipe(item, preferredMealSlot)}
          foodItems={foodItems}
          onClose={() => setLogOpen(false)}
          onLogged={({ mealSlotId, itemCount }) => {
            const slotLabel = memberMealSlotLabel(mealSlotId);
            setLogStatus(
              `${itemCount === 1 ? "1 vare" : `${itemCount} varer`} logget til ${slotLabel.toLowerCase()}.`,
            );
          }}
        />
      ) : null}
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
  onDelete,
  onAvailabilityChange,
}: {
  item: InspirationRecipeItem;
  macros: ReturnType<typeof computeRecipeMacros>;
  adjusted?: boolean;
  onSelect: () => void;
  canManage?: boolean;
  onEdit?: (item: InspirationRecipeItem) => void;
  onDuplicate?: (item: InspirationRecipeItem) => void;
  onDelete?: (item: InspirationRecipeItem) => void;
  onAvailabilityChange?: (item: InspirationRecipeItem, available: boolean) => void;
}) {
  const mealSlots = recipeMealSlotsFor(item);
  const proteinCategory = resolveRecipeProteinCategory(item);

  return (
    <article
      className="flex h-full w-full flex-col overflow-hidden rounded-2xl border bg-white text-left shadow-sm transition hover:border-teal-200 hover:shadow-md"
      style={{ borderColor: "rgba(15,23,42,0.08)" }}
    >
      <button type="button" onClick={onSelect} className="flex flex-1 flex-col text-left">
        <RecipePhoto src={item.imageUrl} size="card" alt="" />
        <div className="flex flex-1 flex-col p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {mealSlots.map((slot) => (
            <span key={slot} className="rounded-full bg-teal-700/90 px-2 py-0.5 text-[10px] font-semibold text-white">
              {mealSlotLabel(slot)}
            </span>
          ))}
          <span className="text-[11px] font-semibold uppercase tracking-wide text-teal-700">{item.tag}</span>
          {recipeShowsProteinType(mealSlots) && proteinCategory ? (
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
      {canManage && (onEdit || onDuplicate || onDelete) ? (
        <div className="border-t px-3 py-2" style={{ borderColor: "rgba(15,23,42,0.06)" }}>
          <div className="flex flex-wrap gap-1.5">
            {onAvailabilityChange ? (
              <button
                type="button"
                role="switch"
                aria-checked={item.availableWithoutMealPlan === true}
                aria-label={`Tilgjengelig uten matplan: ${item.title}`}
                className="mb-1 flex w-full items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-semibold text-slate-700"
                onClick={() => onAvailabilityChange(item, item.availableWithoutMealPlan !== true)}
              >
                <span>Tilgjengelig uten matplan</span>
                <span
                  className={`relative h-5 w-9 rounded-full transition ${
                    item.availableWithoutMealPlan ? "bg-teal-600" : "bg-slate-300"
                  }`}
                  aria-hidden
                >
                  <span
                    className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${
                      item.availableWithoutMealPlan ? "left-[18px]" : "left-0.5"
                    }`}
                  />
                </span>
              </button>
            ) : null}
            {onEdit ? (
            <button
              type="button"
              className="inline-flex min-w-[5.5rem] flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-white"
              onClick={(event) => {
                event.stopPropagation();
                onEdit(item);
              }}
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden />
              Rediger
            </button>
            ) : null}
            {onDuplicate ? (
              <button
                type="button"
                className="inline-flex min-w-[5.5rem] flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-white"
                onClick={(event) => {
                  event.stopPropagation();
                  onDuplicate(item);
                }}
              >
                <Copy className="h-3.5 w-3.5" aria-hidden />
                Dupliser
              </button>
            ) : null}
            {onDelete ? (
              <button
                type="button"
                className="inline-flex min-w-[5.5rem] flex-1 items-center justify-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
                onClick={(event) => {
                  event.stopPropagation();
                  onDelete(item);
                }}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                Slett
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
  memberId?: string;
  onEdit?: (item: InspirationRecipeItem) => void;
  onDuplicate?: (item: InspirationRecipeItem) => void;
  onDelete?: (item: InspirationRecipeItem) => void;
  onAvailabilityChange?: (item: InspirationRecipeItem, available: boolean) => Promise<boolean>;
  hasMealPlan?: boolean;
};

export function NutritionRecipesPanel({
  mealPlanTargets,
  canManage,
  memberId,
  onEdit,
  onDuplicate,
  onDelete,
  onAvailabilityChange,
  hasMealPlan = false,
}: NutritionRecipesPanelProps) {
  const { items, loading } = useInspirationRecipeItems();
  const foodItems = useFoodItemsForMacros();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mealTab, setMealTab] = useState<RecipePanelTab>("all");
  const [proteinFilter, setProteinFilter] = useState<RecipeProteinCategoryFilter>("all");
  const [availabilityOverrides, setAvailabilityOverrides] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setAvailabilityOverrides((current) => {
      const next = { ...current };
      let changed = false;
      for (const item of items) {
        if (item.id in next && item.availableWithoutMealPlan === next[item.id]) {
          delete next[item.id];
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [items]);

  const displayedItems = useMemo(
    () => items.map((item) => (
      item.id in availabilityOverrides
        ? { ...item, availableWithoutMealPlan: availabilityOverrides[item.id] }
        : item
    )),
    [availabilityOverrides, items],
  );

  async function changeAvailability(item: InspirationRecipeItem, available: boolean) {
    if (!onAvailabilityChange) return;
    setAvailabilityOverrides((current) => ({ ...current, [item.id]: available }));
    const saved = await onAvailabilityChange(item, available);
    if (!saved) {
      setAvailabilityOverrides((current) => {
        const next = { ...current };
        delete next[item.id];
        return next;
      });
    }
  }

  const accessibleItems = useMemo(
    () => (canManage || hasMealPlan
      ? displayedItems
      : displayedItems.filter((item) => item.availableWithoutMealPlan === true)),
    [canManage, displayedItems, hasMealPlan],
  );

  const scaledById = useMemo(() => {
    const map = new Map<
      string,
      { macros: ReturnType<typeof computeRecipeMacros>; adjusted: boolean }
    >();
    for (const item of accessibleItems) {
      const mealSlot = recipeMealSlotFor(item);
      const scalingMode = resolveRecipeScalingMode({
        id: item.id,
        scalingMode: item.scalingMode,
        body: item.body,
        title: item.title,
        tag: item.tag,
        servings: item.servings,
      });
      const view = buildScaledRecipeView(item.body, foodItems, {
        scalingMode,
        dailyTargets: mealPlanTargets,
        mealSlot,
        servings: item.servings,
      });
      const macros = view?.macros ?? computeRecipeMacros(item.body, foodItems, { servings: item.servings });
      map.set(item.id, { macros, adjusted: view?.adjusted ?? false });
    }
    return map;
  }, [accessibleItems, foodItems, mealPlanTargets]);

  const itemsByMeal = useMemo(() => {
    const grouped = new Map<RecipeMealSlot, InspirationRecipeItem[]>(
      RECIPE_MEAL_SLOTS.map((slot) => [slot.id, []]),
    );
    for (const item of accessibleItems) {
      for (const slot of recipeMealSlotsFor(item)) {
        grouped.get(slot)?.push(item);
      }
    }
    for (const list of grouped.values()) {
      list.sort((a, b) => a.title.localeCompare(b.title, "no"));
    }
    return grouped;
  }, [accessibleItems]);
  const categoryMembershipCount = useMemo(
    () => RECIPE_MEAL_SLOTS.reduce((sum, slot) => sum + (itemsByMeal.get(slot.id)?.length ?? 0), 0),
    [itemsByMeal],
  );

  const selected = accessibleItems.find((item) => item.id === selectedId) ?? null;
  const supportsProteinFilter = mealTab === "lunsj" || mealTab === "middag";
  const mealItems =
    mealTab === "all"
      ? [...accessibleItems].sort((a, b) => a.title.localeCompare(b.title, "no"))
      : mealTab === "unavailable"
        ? accessibleItems
            .filter((item) => item.availableWithoutMealPlan !== true)
            .sort((a, b) => a.title.localeCompare(b.title, "no"))
        : (itemsByMeal.get(mealTab) ?? []);
  const unavailableCount = accessibleItems.filter((item) => item.availableWithoutMealPlan !== true).length;
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
    return <Card className="p-6 text-center text-sm text-slate-600">Laster måltider …</Card>;
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
        onDelete={onDelete}
        preferredMealSlot={mealTab === "all" || mealTab === "unavailable" ? null : mealTab}
        memberId={memberId}
      />
    );
  }

  if (!accessibleItems.length) {
    return (
      <EmptyState
        icon="🥗"
        title="Ingen måltider ennå"
        description={canManage ? "Opprett et nytt måltid for å komme i gang." : "Treneren har ikke gjort noen måltider tilgjengelige ennå."}
        className="bg-white"
      />
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Måltider med næringsinnhold per porsjon. Velg antall porsjoner inne på måltidet — da oppdateres mengdene,
        ikke næringsinnholdet per porsjon.
      </p>
      <div className="flex flex-wrap gap-2">
        <PillButton
          active={mealTab === "all"}
          onClick={() => {
            setMealTab("all");
            setProteinFilter("all");
          }}
        >
          Alle
          {accessibleItems.length > 0 ? ` (${accessibleItems.length} unike)` : ""}
        </PillButton>
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
        {canManage ? (
          <PillButton
            active={mealTab === "unavailable"}
            onClick={() => {
              setMealTab("unavailable");
              setProteinFilter("all");
            }}
          >
            Ikke tilgjengelige
            {unavailableCount > 0 ? ` (${unavailableCount})` : ""}
          </PillButton>
        ) : null}
      </div>
      {categoryMembershipCount !== accessibleItems.length ? (
        <p className="text-xs text-slate-500">
          {accessibleItems.length} unike måltider · {categoryMembershipCount} kategoriplasseringer. Et måltid kan være med i flere kategorier.
        </p>
      ) : null}
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
          title={mealTab === "unavailable"
            ? "Alle måltider er tilgjengelige"
            : `Ingen ${RECIPE_MEAL_SLOTS.find((s) => s.id === mealTab)?.label?.toLowerCase() ?? "måltider"}`}
          description={mealTab === "unavailable"
            ? "Måltider du skjuler for kunder uten matplan, vises her."
            : "Velg Alle, eller en annen kategori. Nye måltider vises under alle kategoriene du huker av når du lagrer."}
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
                onDelete={onDelete}
                onAvailabilityChange={onAvailabilityChange
                  ? (recipe, available) => void changeAvailability(recipe, available)
                  : undefined}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
