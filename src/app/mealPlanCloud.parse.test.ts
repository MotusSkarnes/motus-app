import { describe, expect, it } from "vitest";
import { mealPlanFromRow } from "./mealPlanCloud";

describe("mealPlanFromRow days parsing", () => {
  it("parses days when stored as JSON string", () => {
    const days = [
      {
        id: "day-0",
        label: "Mandag",
        meals: [{ id: "m1", name: "Frokost", items: [{ foodName: "Egg", grams: 100, nutritionPer100g: {} }] }],
      },
    ];
    const plan = mealPlanFromRow("member-nmn08uu", {
      member_id: "member-nmn08uu",
      title: "Matplan",
      days: JSON.stringify(days),
    });
    expect(plan.days).toHaveLength(1);
    expect(plan.days[0]?.meals[0]?.items[0]?.foodName).toBe("Egg");
  });

  it("parses proteinPerKg and kcalLocked on targets", () => {
    const plan = mealPlanFromRow("member-1", {
      member_id: "member-1",
      title: "Matplan",
      days: JSON.stringify([]),
      targets: { kcal: 1900, proteinPerKg: 1.6, protein: 120, kcalLocked: true },
    });
    expect(plan.targets?.kcalLocked).toBe(true);
    expect(plan.targets?.proteinPerKg).toBe(1.6);
    expect(plan.targets?.protein).toBe(120);
  });

  it("parses planningWeightKg on targets", () => {
    const plan = mealPlanFromRow("template-1", {
      member_id: "template-1",
      title: "Mal",
      days: JSON.stringify([]),
      targets: { planningWeightKg: 75, proteinPerKg: 1.6, protein: 120 },
    });
    expect(plan.targets?.planningWeightKg).toBe(75);
    expect(plan.targets?.proteinPerKg).toBe(1.6);
  });
});
