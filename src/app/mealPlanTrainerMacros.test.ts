import { describe, expect, it } from "vitest";
import { createDefaultMealPlan } from "./mealPlanDefaults";
import {
  copyMealToDays,
  distributeDailyTargetsToMeals,
  remainingMacros,
  sumDayMacros,
} from "./mealPlanTrainerMacros";

describe("mealPlanTrainerMacros", () => {
  it("beregner gjenstående makroer", () => {
    const remaining = remainingMacros(
      { kcal: 2000, protein: 150, carbs: 200, fat: 65 },
      { kcal: 500, protein: 40, carbs: 50, fat: 20 },
    );
    expect(remaining.hasTargets).toBe(true);
    expect(remaining.kcal).toBe(1500);
    expect(remaining.protein).toBe(110);
  });

  it("fordeler makro på måltid", () => {
    const plan = createDefaultMealPlan("m1");
    const day = plan.days[0];
    const meals = distributeDailyTargetsToMeals(day, { kcal: 2000, protein: 150, carbs: 200, fat: 65 }, "standard");
    const frokost = meals.find((m) => m.name === "Frokost");
    expect(frokost?.targets?.kcal).toBe(440);
  });

  it("kopierer måltid til annen dag", () => {
    const plan = createDefaultMealPlan("m1");
    const monday = plan.days[0];
    const tuesday = plan.days[1];
    const meal = monday.meals[0];
    meal.items.push({
      id: "f1",
      foodId: "egg",
      foodName: "Egg",
      grams: 100,
      nutritionPer100g: { kcal: 155, protein: 13, carbs: 1, fat: 11, fiber: 0, sugar: 0, saturatedFat: 0, sodium: 0 },
    });
    const next = copyMealToDays(plan, monday.id, meal.id, [tuesday.id]);
    const tueMeal = next.days[1].meals.find((m) => m.name === "Frokost");
    expect(tueMeal?.items.length).toBe(1);
    expect(sumDayMacros(next.days[1]).kcal).toBeGreaterThan(0);
  });
});
