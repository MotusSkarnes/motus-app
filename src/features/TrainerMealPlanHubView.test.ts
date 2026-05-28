import { describe, expect, it } from "vitest";
import { createDefaultMealPlan } from "../app/mealPlanDefaults";
import { applyTemplateWithMode, buildTemplateApplyPreview } from "./TrainerMealPlanHubView";

function withOneItemPlan(memberId: string, foodName: string) {
  const plan = createDefaultMealPlan(memberId);
  plan.days[0].meals[0].items = [
    {
      id: `${memberId}-item`,
      foodId: "food-1",
      foodName,
      grams: 100,
      nutritionPer100g: { kcal: 100, protein: 10, carbs: 10, fat: 3, fiber: 0, sugar: 0, saturatedFat: 0, sodium: 0 },
    },
  ];
  return plan;
}

describe("TrainerMealPlanHubView helpers", () => {
  it("builds preview counts for overwrite/add", () => {
    const template = withOneItemPlan("tpl", "Egg");
    const target = withOneItemPlan("member-1", "Skyr");
    const preview = buildTemplateApplyPreview(template, target);
    expect(preview.mealsWithTemplateItems).toBe(1);
    expect(preview.overwriteMeals).toBe(1);
    expect(preview.addMeals).toBe(0);
  });

  it("merge mode keeps existing filled meals", () => {
    const template = withOneItemPlan("tpl", "Egg");
    const target = withOneItemPlan("member-1", "Skyr");
    const merged = applyTemplateWithMode(template, "member-1", target, "merge");
    expect(merged.days[0].meals[0].items[0]?.foodName).toBe("Skyr");
  });

  it("replace mode uses template meals", () => {
    const template = withOneItemPlan("tpl", "Egg");
    const target = withOneItemPlan("member-1", "Skyr");
    const replaced = applyTemplateWithMode(template, "member-1", target, "replace");
    expect(replaced.days[0].meals[0].items[0]?.foodName).toBe("Egg");
  });
});
