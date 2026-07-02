import type { InspirationRecipeItem } from "./inspirationRecipeItems";
import type { FoodItem } from "./foodBankTypes";
import { parseInspirationRecipeFoodId } from "./mealPlanRecipeEntry";
import type { MealPlan, MealPlanFoodEntry, MealPlanTargets } from "./mealPlanTypes";
import { buildScaledRecipeView, resolveRecipeScalingMode } from "./recipeMealScaling";
import type { RecipeMealSlot } from "./recipeMealCategory";
import { resolveRecipeMealSlot } from "./recipeMealCategory";

export type ShoppingListItem = {
  key: string;
  name: string;
  grams: number;
  displayLabel: string;
};

export type ShoppingListGroup = {
  id: string;
  label: string;
  items: ShoppingListItem[];
};

export type ShoppingListRecipeControl = {
  entryId: string;
  recipeId: string;
  title: string;
  dayLabel: string;
  mealName: string;
  portionMultiplier: number;
};

export type WeeklyShoppingListResult = {
  groups: ShoppingListGroup[];
  recipeControls: ShoppingListRecipeControl[];
  warnings: string[];
};

const CATEGORY_LABELS: Record<string, string> = {
  proteinkilder: "Proteiner",
  karbohydrater: "Karbohydrater",
  fettkilder: "Fett",
  gronnsaker: "Grønnsaker",
  "frukt-baer": "Frukt & bær",
  meieriprodukter: "Meieri",
  annet: "Annet",
};

const CATEGORY_ORDER = [
  "proteinkilder",
  "karbohydrater",
  "meieriprodukter",
  "gronnsaker",
  "frukt-baer",
  "fettkilder",
  "annet",
];

type TotalsRow = {
  name: string;
  grams: number;
  category: string;
  displayLabel: string;
};

function clampPortionMultiplier(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1;
  return Math.min(20, Math.max(0.25, Math.round(value * 4) / 4));
}

function resolveMealSlotFromMealName(mealName: string, recipe: InspirationRecipeItem): RecipeMealSlot | null {
  const fromName = mealName.toLowerCase();
  if (fromName.includes("frokost")) return "frokost";
  if (fromName.includes("lunsj")) return "lunsj";
  if (fromName.includes("middag")) return "middag";
  if (fromName.includes("snack") || fromName.includes("mellom")) return "snack";
  return resolveRecipeMealSlot(recipe.tag, recipe.title, recipe.description);
}

function formatGramsLabel(name: string, grams: number): string {
  const rounded = Math.round(grams);
  if (rounded <= 0) return name;
  return `${name} (${rounded} g)`;
}

function mergeTotals(
  totals: Map<string, TotalsRow>,
  key: string,
  row: TotalsRow,
): void {
  const existing = totals.get(key);
  if (existing) {
    existing.grams += row.grams;
    existing.displayLabel = formatGramsLabel(row.name, existing.grams);
  } else {
    totals.set(key, { ...row, displayLabel: formatGramsLabel(row.name, row.grams) });
  }
}

function expandRecipeEntryToTotals(
  item: MealPlanFoodEntry,
  recipe: InspirationRecipeItem,
  mealName: string,
  portionMultiplier: number,
  foodItems: FoodItem[],
  planTargets: MealPlanTargets | undefined,
  totals: Map<string, TotalsRow>,
  warnings: string[],
): void {
  const body = recipe.body.trim() || recipe.description.trim();
  if (!body) {
    warnings.push(`«${recipe.title}» mangler oppskriftstekst.`);
    return;
  }

  const mealSlot = resolveMealSlotFromMealName(mealName, recipe);
  const scalingMode = resolveRecipeScalingMode({
    id: recipe.id,
    scalingMode: recipe.scalingMode,
    body,
    title: recipe.title,
    tag: recipe.tag,
  });
  const scaled = buildScaledRecipeView(body, foodItems, {
    scalingMode,
    dailyTargets: planTargets,
    mealSlot,
    servings: recipe.servings,
    ingredientFoodOverrides: recipe.ingredientFoodOverrides,
  });

  if (!scaled?.ingredients.length) {
    warnings.push(`«${recipe.title}» — kunne ikke lese ingredienslisten.`);
    return;
  }

  for (const ing of scaled.ingredients) {
    const grams = ing.grams * portionMultiplier;
    if (grams <= 0) continue;
    const key = ing.foodId || ing.foodName;
    mergeTotals(totals, key, {
      name: ing.foodName,
      grams,
      category: ing.category,
      displayLabel: formatGramsLabel(ing.foodName, grams),
    });
  }
}

function expandFoodEntryToTotals(
  item: MealPlanFoodEntry,
  food: FoodItem | undefined,
  portionMultiplier: number,
  totals: Map<string, TotalsRow>,
): void {
  const grams = item.grams * portionMultiplier;
  if (grams <= 0) return;
  const category = food?.category ?? "annet";
  const key = item.foodId || item.foodName;
  mergeTotals(totals, key, {
    name: item.foodName,
    grams,
    category,
    displayLabel: formatGramsLabel(item.foodName, grams),
  });
}

export type BuildWeeklyShoppingListInput = {
  plan: MealPlan;
  foodById: Map<string, FoodItem>;
  foodItems: FoodItem[];
  recipesById: Map<string, InspirationRecipeItem>;
  recipePortions?: Record<string, number>;
};

export function buildWeeklyShoppingList(input: BuildWeeklyShoppingListInput): WeeklyShoppingListResult {
  const { plan, foodById, foodItems, recipesById, recipePortions = {} } = input;
  const totals = new Map<string, TotalsRow>();
  const recipeControls: ShoppingListRecipeControl[] = [];
  const warnings: string[] = [];
  const seenRecipeControls = new Set<string>();

  for (const day of plan.days) {
    for (const meal of day.meals) {
      for (const item of meal.items) {
        const portionMultiplier = clampPortionMultiplier(recipePortions[item.id] ?? 1);
        const recipeId = parseInspirationRecipeFoodId(item.foodId);

        if (recipeId) {
          const recipe = recipesById.get(recipeId);
          if (!recipe) {
            warnings.push(`«${item.foodName}» finnes ikke i oppskriftsbiblioteket.`);
            continue;
          }
          const controlKey = `${item.id}:${day.id}`;
          if (!seenRecipeControls.has(controlKey)) {
            seenRecipeControls.add(controlKey);
            recipeControls.push({
              entryId: item.id,
              recipeId,
              title: recipe.title || item.foodName,
              dayLabel: day.label,
              mealName: meal.name,
              portionMultiplier,
            });
          }
          expandRecipeEntryToTotals(
            item,
            recipe,
            meal.name,
            portionMultiplier,
            foodItems,
            plan.targets,
            totals,
            warnings,
          );
          continue;
        }

        expandFoodEntryToTotals(item, foodById.get(item.foodId), portionMultiplier, totals);
      }
    }
  }

  const byCategory = new Map<string, ShoppingListItem[]>();
  for (const [key, row] of totals) {
    const list = byCategory.get(row.category) ?? [];
    list.push({
      key,
      name: row.name,
      grams: Math.round(row.grams),
      displayLabel: row.displayLabel,
    });
    byCategory.set(row.category, list);
  }

  const groups: ShoppingListGroup[] = [];
  for (const catId of CATEGORY_ORDER) {
    const items = byCategory.get(catId);
    if (!items?.length) continue;
    groups.push({
      id: catId,
      label: CATEGORY_LABELS[catId] ?? catId,
      items: items.sort((a, b) => a.name.localeCompare(b.name, "nb")),
    });
    byCategory.delete(catId);
  }

  for (const [catId, items] of byCategory) {
    groups.push({
      id: catId,
      label: CATEGORY_LABELS[catId] ?? catId,
      items: items.sort((a, b) => a.name.localeCompare(b.name, "nb")),
    });
  }

  recipeControls.sort((a, b) => {
    const day = a.dayLabel.localeCompare(b.dayLabel, "nb");
    if (day !== 0) return day;
    return a.title.localeCompare(b.title, "nb");
  });

  return { groups, recipeControls, warnings: [...new Set(warnings)] };
}

/** @deprecated Bruk buildWeeklyShoppingList med full input — beholdt for enkle kall. */
export function buildWeeklyShoppingListLegacy(plan: MealPlan, foodById: Map<string, FoodItem>): ShoppingListGroup[] {
  return buildWeeklyShoppingList({
    plan,
    foodById,
    foodItems: [...foodById.values()],
    recipesById: new Map(),
  }).groups;
}
