import { formatDateDdMmYyyy } from "./dateFormat";
import { uid } from "./storage";
import type { MealPlan, MealPlanDay, MealPlanMeal } from "./mealPlanTypes";

const WEEKDAY_LABELS = ["Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag", "Søndag"];

function defaultMealsForDay(dayIndex: number): MealPlanMeal[] {
  const prefix = `meal-${dayIndex}`;
  return [
    { id: `${prefix}-frokost`, name: "Frokost", items: [] },
    { id: `${prefix}-lunsj`, name: "Lunsj", items: [] },
    { id: `${prefix}-middag`, name: "Middag", items: [] },
    { id: `${prefix}-snacks`, name: "Snacks", items: [] },
  ];
}

export function createDefaultMealPlanDays(): MealPlanDay[] {
  return WEEKDAY_LABELS.map((label, index) => ({
    id: `day-${index}`,
    label,
    meals: defaultMealsForDay(index),
  }));
}

export function createDefaultMealPlan(memberId: string, title = "Matplan"): MealPlan {
  const trimmedMemberId = memberId.trim();
  return {
    id: uid("mealplan"),
    memberId: trimmedMemberId,
    title: title.trim() || "Matplan",
    notes: "",
    days: createDefaultMealPlanDays(),
    createdAt: formatDateDdMmYyyy(new Date()),
  };
}
