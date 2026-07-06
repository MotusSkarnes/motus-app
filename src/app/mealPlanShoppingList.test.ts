import { describe, expect, it } from "vitest";
import { DEFAULT_INSPIRATION_RECIPES } from "./defaultInspirationRecipes";
import { buildDefaultFoodBankItems } from "./foodBankSeed";
import { recipeToMealPlanEntry } from "./mealPlanRecipeEntry";
import type { MealPlan } from "./mealPlanTypes";
import { buildWeeklyShoppingList } from "./mealPlanShoppingList";
import { computeRecipeIngredients } from "./recipeMacros";

const BOLOGNESE = DEFAULT_INSPIRATION_RECIPES.find((r) => r.id === "default-recipe-7")!;

function makePlanWithRecipe(): MealPlan {
  const foods = buildDefaultFoodBankItems();
  const entry = recipeToMealPlanEntry(BOLOGNESE, foods);
  return {
    id: "plan-1",
    memberId: "m1",
    title: "Test",
    notes: "",
    createdAt: new Date().toISOString(),
    days: [
      {
        id: "day-mon",
        label: "Mandag",
        meals: [
          {
            id: "meal-dinner",
            name: "Middag",
            items: [entry],
          },
        ],
      },
    ],
  };
}

describe("buildWeeklyShoppingList", () => {
  it("ekspanderer oppskriftsingredienser i stedet for oppskriftstittel", () => {
    const foods = buildDefaultFoodBankItems();
    const foodById = new Map(foods.map((f) => [f.id, f]));
    const recipesById = new Map([[BOLOGNESE.id, { ...BOLOGNESE, scalingMode: BOLOGNESE.scalingMode }]]);
    const result = buildWeeklyShoppingList({
      plan: makePlanWithRecipe(),
      foodById,
      foodItems: foods,
      recipesById,
    });

    const allNames = result.groups.flatMap((g) => g.items.map((i) => i.name.toLowerCase()));
    expect(allNames.some((n) => n.includes("kjøtt") || n.includes("karbonade"))).toBe(true);
    expect(allNames.some((n) => n.includes("pasta"))).toBe(true);
    expect(allNames.every((n) => !n.includes("bolognese"))).toBe(true);
    expect(result.recipeControls).toHaveLength(1);
  });

  it("skalerer ingredienser med porsjonsmultiplikator", () => {
    const foods = buildDefaultFoodBankItems();
    const foodById = new Map(foods.map((f) => [f.id, f]));
    const recipesById = new Map([[BOLOGNESE.id, { ...BOLOGNESE, scalingMode: BOLOGNESE.scalingMode }]]);
    const plan = makePlanWithRecipe();
    const entryId = plan.days[0].meals[0].items[0].id;

    const base = buildWeeklyShoppingList({
      plan,
      foodById,
      foodItems: foods,
      recipesById,
      recipePortions: { [entryId]: 1 },
    });
    const doubled = buildWeeklyShoppingList({
      plan,
      foodById,
      foodItems: foods,
      recipesById,
      recipePortions: { [entryId]: 2 },
    });

    const baseGrams = base.groups.reduce((sum, g) => sum + g.items.reduce((s, i) => s + i.grams, 0), 0);
    const doubledGrams = doubled.groups.reduce((sum, g) => sum + g.items.reduce((s, i) => s + i.grams, 0), 0);
    expect(doubledGrams).toBeGreaterThan(baseGrams * 1.8);
  });

  it("viser ingrediensmengder per oppskriftsporsjon", () => {
    const foods = buildDefaultFoodBankItems();
    const foodById = new Map(foods.map((f) => [f.id, f]));
    const recipesById = new Map([[BOLOGNESE.id, { ...BOLOGNESE, scalingMode: BOLOGNESE.scalingMode }]]);
    const result = buildWeeklyShoppingList({
      plan: makePlanWithRecipe(),
      foodById,
      foodItems: foods,
      recipesById,
    });

    const meat = result.groups
      .flatMap((group) => group.items)
      .find((item) => item.name.toLowerCase().includes("karbonadedeig"));
    expect(meat?.grams).toBeGreaterThanOrEqual(95);
    expect(meat?.grams).toBeLessThanOrEqual(105);
  });

  it("bruker lagrede ingredienskoblinger i handlelisten", () => {
    const foods = buildDefaultFoodBankItems();
    const foodById = new Map(foods.map((f) => [f.id, f]));
    const soyafarse = foods.find((item) => item.name === "Soyafarse");
    const meat = computeRecipeIngredients(BOLOGNESE.body, foods).find((row) =>
      row.searchText.includes("kjøttdeig"),
    );
    expect(soyafarse).toBeTruthy();
    expect(meat).toBeTruthy();

    const recipe = {
      ...BOLOGNESE,
      scalingMode: BOLOGNESE.scalingMode,
      ingredientFoodOverrides: { [meat!.key]: soyafarse!.id },
    };
    const result = buildWeeklyShoppingList({
      plan: makePlanWithRecipe(),
      foodById,
      foodItems: foods,
      recipesById: new Map([[BOLOGNESE.id, recipe]]),
    });

    const names = result.groups.flatMap((group) => group.items.map((item) => item.name));
    expect(names).toContain("Soyafarse");
    expect(names).not.toContain("Karbonadedeig mager");
  });
});
