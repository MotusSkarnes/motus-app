import { formatDateDdMmYyyy } from "./dateFormat";
import { createMealPlanDaysWithSlots, DEFAULT_MEAL_PLAN_SLOT_IDS, type MealPlanSlotId } from "./mealPlanMealSlots";
import { uid } from "./storage";
import type { MealPlan } from "./mealPlanTypes";

export function createDefaultMealPlanDays(mealSlotIds: MealPlanSlotId[] = DEFAULT_MEAL_PLAN_SLOT_IDS) {
  return createMealPlanDaysWithSlots(mealSlotIds);
}

export function createDefaultMealPlan(
  memberId: string,
  options?: { title?: string; mealSlotIds?: MealPlanSlotId[] },
): MealPlan {
  const trimmedMemberId = memberId.trim();
  const mealSlotIds = options?.mealSlotIds?.length ? options.mealSlotIds : DEFAULT_MEAL_PLAN_SLOT_IDS;
  return {
    id: uid("mealplan"),
    memberId: trimmedMemberId,
    title: options?.title?.trim() || "Matplan",
    notes: "",
    days: createMealPlanDaysWithSlots(mealSlotIds),
    createdAt: formatDateDdMmYyyy(new Date()),
  };
}
