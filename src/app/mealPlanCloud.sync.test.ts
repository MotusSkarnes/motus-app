import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultMealPlan } from "./mealPlanDefaults";
import { MEAL_PLANS_STORAGE_KEY, loadMealPlanForMember, persistMealPlan } from "./mealPlanStorage";
import type { MealPlan } from "./mealPlanTypes";

const { fetchRowsByMemberId } = vi.hoisted(() => ({
  fetchRowsByMemberId: new Map<string, { data: Record<string, unknown> | null; error: { message: string } | null }>(),
}));

vi.mock("../services/supabaseClient", () => ({
  isSupabaseConfigured: true,
  supabaseClient: {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: null } })),
    },
    from: vi.fn((table: string) => {
      if (table === "member_meal_plans") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn((_column: string, memberId: string) => ({
              maybeSingle: vi.fn(async () => fetchRowsByMemberId.get(memberId) ?? { data: null, error: null }),
            })),
          })),
        };
      }
      return {
        select: vi.fn(() => ({
          ilike: vi.fn(async () => ({ data: [] })),
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({ data: null, error: null })),
          })),
        })),
      };
    }),
  },
}));

function mealPlanWithFood(memberId: string): MealPlan {
  const plan = createDefaultMealPlan(memberId);
  return {
    ...plan,
    days: plan.days.map((day, dayIndex) =>
      dayIndex === 0
        ? {
            ...day,
            meals: day.meals.map((meal, mealIndex) =>
              mealIndex === 0
                ? {
                    ...meal,
                    items: [
                      {
                        id: "food-1",
                        foodId: "oats",
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
  };
}

describe("syncMealPlanForMember", () => {
  beforeEach(() => {
    fetchRowsByMemberId.clear();
    window.localStorage.removeItem(MEAL_PLANS_STORAGE_KEY);
  });

  it("keeps a local meal plan with food when cloud returns no row", async () => {
    const { syncMealPlanForMember } = await import("./mealPlanCloud");
    const local = mealPlanWithFood("member-a");
    persistMealPlan(local, { notify: false });

    const result = await syncMealPlanForMember("member-a", "trainer-user");

    expect(result.cloudSynced).toBe(false);
    expect(result.noMealPlanInCloud).toBe(false);
    expect(result.plan?.days[0]?.meals[0]?.items[0]?.foodName).toBe("Havregryn");
    expect(loadMealPlanForMember("member-a")?.days[0]?.meals[0]?.items[0]?.foodName).toBe("Havregryn");
  });

  it("reports partial member-id lookup failures as fetch errors", async () => {
    const { fetchMealPlanFromSupabase } = await import("./mealPlanCloud");
    fetchRowsByMemberId.set("member-a", { data: null, error: { message: "timeout" } });
    fetchRowsByMemberId.set("member-b", { data: null, error: null });

    const result = await fetchMealPlanFromSupabase(["member-a", "member-b"]);

    expect(result.plan).toBeNull();
    expect(result.hadFetchErrors).toBe(true);
  });
});
