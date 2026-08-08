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

  it("bruker manuelle ingredienskoblinger i handlelisten", () => {
    const foods = buildDefaultFoodBankItems();
    const foodById = new Map(foods.map((f) => [f.id, f]));
    const body = "**Til 1 porsjon**\n\n**Ingredienser**\n- 200 g kjøttdeig";
    const auto = computeRecipeIngredients(body, foods)[0];
    const soyafarse = foods.find((food) => food.name === "Soyafarse");
    expect(auto?.foodName).toBe("Karbonadedeig mager");
    expect(soyafarse).toBeDefined();
    const recipe = {
      id: "r-soy",
      title: "Plantebolognese",
      description: "Middag",
      tag: "Middag",
      body,
      ingredientFoodOverrides: { [auto!.key]: soyafarse!.id },
    };
    const entry = recipeToMealPlanEntry(recipe, foods);
    const plan: MealPlan = {
      id: "plan-override",
      memberId: "m1",
      title: "Test",
      notes: "",
      createdAt: new Date().toISOString(),
      days: [
        {
          id: "day-mon",
          label: "Mandag",
          meals: [{ id: "meal-dinner", name: "Middag", items: [entry] }],
        },
      ],
    };

    const result = buildWeeklyShoppingList({
      plan,
      foodById,
      foodItems: foods,
      recipesById: new Map([[recipe.id, recipe]]),
    });

    const allNames = result.groups.flatMap((group) => group.items.map((item) => item.name));
    expect(allNames).toContain("Soyafarse");
    expect(allNames).not.toContain("Karbonadedeig mager");
  });
});
