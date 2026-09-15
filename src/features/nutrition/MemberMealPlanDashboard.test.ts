import { describe, expect, it } from "vitest";
import { sumQuickFoodLogMacros } from "../../app/quickFoodLogMacros";
import { extractRecipeMethodSteps, formatMealEntryAmount, loggedMealEntriesFromPlanMeal } from "./MemberMealPlanDashboard";

describe("MemberMealPlanDashboard helpers", () => {
  it("formats recipe amount as portions", () => {
    expect(formatMealEntryAmount("inspo-recipe-abc", 100)).toBe("1 porsjon");
    expect(formatMealEntryAmount("inspo-recipe-abc", 150)).toBe("1.5 porsjoner");
  });

  it("extracts method steps after 'Slik gjør du'", () => {
    const body = `**Til 1 porsjon**\n\n**Ingredienser**\n- 100 g skyr\n\n**Slik gjør du**\n1. Bland i bolle.\n2. Topp med bær.\n\n**Tips:** Server kald.`;
    expect(extractRecipeMethodSteps(body)).toEqual(["Bland i bolle.", "Topp med bær."]);
  });

  it("includes quick food logs in macro sums", () => {
    const macros = sumQuickFoodLogMacros([
      {
        id: "q1",
        name: "Skyr",
        grams: 150,
        source: "food",
        loggedAt: new Date().toISOString(),
        nutritionPer100g: { kcal: 60, protein: 10, carbs: 4, fat: 0.2, fiber: 0, sugar: 4, saturatedFat: 0, sodium: 40 },
      },
    ]);
    expect(Math.round(macros.kcal)).toBe(90);
    expect(Math.round(macros.protein)).toBe(15);
  });

  it("collects logged plan foods and self-logs for saved meals", () => {
    const meal = {
      id: "meal-0-frokost",
      name: "Frokost",
      items: [
        {
          id: "food-1",
          foodId: "havre",
          foodName: "Havregryn",
          grams: 80,
          nutritionPer100g: { kcal: 370, protein: 13, carbs: 60, fat: 7, fiber: 8, sugar: 1, saturatedFat: 1, sodium: 0 },
        },
        {
          id: "food-2",
          foodId: "melk",
          foodName: "Melk",
          grams: 200,
          nutritionPer100g: { kcal: 46, protein: 3, carbs: 5, fat: 2, fiber: 0, sugar: 5, saturatedFat: 1, sodium: 40 },
        },
      ],
    };
    const selfLogs = [
      {
        id: "q1",
        name: "Banan",
        grams: 120,
        source: "food" as const,
        mealId: meal.id,
        loggedAt: new Date().toISOString(),
        nutritionPer100g: { kcal: 89, protein: 1, carbs: 23, fat: 0.3, fiber: 3, sugar: 12, saturatedFat: 0, sodium: 1 },
      },
    ];
    const entries = loggedMealEntriesFromPlanMeal(meal, new Set(["food-1"]), new Set(["food-2"]), selfLogs);
    expect(entries.map((row) => row.name)).toEqual(["Havregryn", "Banan"]);
  });
});
