import { describe, expect, it } from "vitest";
import { createDefaultMealPlan } from "./mealPlanDefaults";
import { autoFillWeekFromMonday, resizeMealPlanWeeks } from "./mealPlanWeekPlanner";

describe("resizeMealPlanWeeks", () => {
  it("resizes plan from 1 to 12 and back to 1 week", () => {
    const base = createDefaultMealPlan("member-1");
    const expanded = resizeMealPlanWeeks(base, 12);
    expect(expanded.days).toHaveLength(84);
    expect(expanded.days[0]?.label).toBe("Mandag (uke 1)");
    expect(expanded.days[83]?.label).toBe("Søndag (uke 12)");

    const reduced = resizeMealPlanWeeks(expanded, 1);
    expect(reduced.days).toHaveLength(7);
    expect(reduced.days[0]?.label).toBe("Mandag");
    expect(reduced.days[6]?.label).toBe("Søndag");
  });
});

describe("autoFillWeekFromMonday", () => {
  it("copies monday meals for each week block", () => {
    const base = resizeMealPlanWeeks(createDefaultMealPlan("member-1"), 2);
    base.days[0].meals[0].items = [
      {
        id: "m1-food",
        foodId: "egg",
        foodName: "Egg",
        grams: 100,
        nutritionPer100g: { kcal: 100, protein: 10, carbs: 1, fat: 5, fiber: 0, sugar: 0, saturatedFat: 0, sodium: 0 },
      },
    ];
    base.days[7].meals[0].items = [
      {
        id: "m2-food",
        foodId: "oats",
        foodName: "Havre",
        grams: 80,
        nutritionPer100g: { kcal: 380, protein: 13, carbs: 60, fat: 7, fiber: 10, sugar: 1, saturatedFat: 1, sodium: 0 },
      },
    ];

    const filled = autoFillWeekFromMonday(base);
    expect(filled.days[1].meals[0].items[0]?.foodName).toBe("Egg");
    expect(filled.days[8].meals[0].items[0]?.foodName).toBe("Havre");
  });
});
