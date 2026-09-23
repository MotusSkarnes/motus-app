import { describe, expect, it } from "vitest";
import { createDefaultMealPlan } from "./mealPlanDefaults";
import { mealPlanCloudWriteMemberIds, pickPreferredMealPlan, resolveTrainerMealPlanLoadStatus } from "./mealPlanCloud";
import type { MealPlan } from "./mealPlanTypes";
import { memberIdsMatchingExactEmail } from "../services/memberEmailExactMatch";

describe("pickPreferredMealPlan for trainer load", () => {
  it("prefers local plan with food over remote shell with empty meals", () => {
    const memberId = "member-test";
    const remoteShell: MealPlan = {
      ...createDefaultMealPlan(memberId),
      updatedAt: "2020-01-01T00:00:00.000Z",
    };
    const localRich: MealPlan = {
      ...createDefaultMealPlan(memberId),
      days: createDefaultMealPlan(memberId).days.map((day, dayIndex) =>
        dayIndex === 0
          ? {
              ...day,
              meals: day.meals.map((meal, mealIndex) =>
                mealIndex === 0
                  ? {
                      ...meal,
                      items: [
                        {
                          id: "f1",
                          foodId: "food-1",
                          foodName: "Havregryn",
                          grams: 80,
                          nutritionPer100g: { kcal: 370, protein: 13, carbs: 60, fat: 7 },
                        },
                      ],
                    }
                  : meal,
              ),
            }
          : day,
      ),
      updatedAt: "2026-01-01T00:00:00.000Z",
    };

    const preferred = pickPreferredMealPlan([remoteShell, localRich]);
    expect(preferred).toBe(localRich);
  });

  it("marks a plan as cloud when the same content already exists locally", () => {
    const plan = createDefaultMealPlan("member-test");
    expect(resolveTrainerMealPlanLoadStatus(plan)).toBe("cloud");
    expect(resolveTrainerMealPlanLoadStatus(null)).toBe("local");
  });
});

describe("mealPlanCloudWriteMemberIds", () => {
  it("does not cloud-save a sibling client whose email only matches via ILIKE _", () => {
    const lookupIds = memberIdsMatchingExactEmail(
      [
        { id: "jane-underscore", email: "jane_doe@motus.no" },
        { id: "jane-wildcard", email: "janexdoe@motus.no" },
      ],
      "jane_doe@motus.no",
    );
    expect(mealPlanCloudWriteMemberIds("jane-underscore", lookupIds)).toEqual(["jane-underscore"]);
  });

  it("still fans out to true duplicate rows with the same email", () => {
    const lookupIds = memberIdsMatchingExactEmail(
      [
        { id: "row-a", email: "kari@motus.no" },
        { id: "row-b", email: "kari@motus.no" },
      ],
      "kari@motus.no",
    );
    expect(mealPlanCloudWriteMemberIds("row-a", lookupIds)).toEqual(["row-a", "row-b"]);
  });
});
