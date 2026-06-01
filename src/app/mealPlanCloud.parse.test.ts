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
});
