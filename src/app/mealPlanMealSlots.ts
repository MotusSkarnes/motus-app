import type { MealPlan, MealPlanDay, MealPlanMeal } from "./mealPlanTypes";

export type MealPlanSlotId = "frokost" | "lunsj" | "middag" | "kvelds" | "mellommaltid";

export type MealPlanSlotDefinition = {
  id: MealPlanSlotId;
  label: string;
};

export const MEAL_PLAN_SLOT_DEFINITIONS: MealPlanSlotDefinition[] = [
  { id: "frokost", label: "Frokost" },
  { id: "lunsj", label: "Lunsj" },
  { id: "middag", label: "Middag" },
  { id: "kvelds", label: "Kvelds" },
  { id: "mellommaltid", label: "Mellommåltid" },
];

/** Standard fire måltider (som før, med «Mellommåltid» i stedet for «Snacks»). */
export const DEFAULT_MEAL_PLAN_SLOT_IDS: MealPlanSlotId[] = ["frokost", "lunsj", "middag", "mellommaltid"];

const SLOT_BY_ID = new Map(MEAL_PLAN_SLOT_DEFINITIONS.map((slot) => [slot.id, slot]));

export function mealSlotLabelFromId(slotId: MealPlanSlotId): string {
  return SLOT_BY_ID.get(slotId)?.label ?? slotId;
}

export function mealNameToSlotId(name: string): MealPlanSlotId | null {
  const n = name.trim().toLowerCase();
  if (n.includes("frokost")) return "frokost";
  if (n.includes("lunsj")) return "lunsj";
  if (n.includes("middag")) return "middag";
  if (n.includes("kvelds")) return "kvelds";
  if (n.includes("mellom") || n.includes("snack")) return "mellommaltid";
  return null;
}

export function createMealsForDay(dayIndex: number, slotIds: MealPlanSlotId[]): MealPlanMeal[] {
  return slotIds.map((slotId) => ({
    id: `meal-${dayIndex}-${slotId}`,
    name: mealSlotLabelFromId(slotId),
    items: [],
  }));
}

const WEEKDAY_LABELS = ["Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag", "Søndag"];

export function createMealPlanDaysWithSlots(slotIds: MealPlanSlotId[]): MealPlanDay[] {
  const ids = slotIds.length ? slotIds : [...DEFAULT_MEAL_PLAN_SLOT_IDS];
  return WEEKDAY_LABELS.map((label, index) => ({
    id: `day-${index}`,
    label,
    meals: createMealsForDay(index, ids),
  }));
}

export function inferMealSlotIdsFromPlan(plan: MealPlan): MealPlanSlotId[] {
  const day = plan.days[0];
  if (!day?.meals.length) return [...DEFAULT_MEAL_PLAN_SLOT_IDS];
  const ids: MealPlanSlotId[] = [];
  for (const meal of day.meals) {
    const slotId = mealNameToSlotId(meal.name);
    if (slotId && !ids.includes(slotId)) ids.push(slotId);
  }
  return ids.length ? ids : [...DEFAULT_MEAL_PLAN_SLOT_IDS];
}

export function plannerSlotLabelsFromIds(slotIds: MealPlanSlotId[]): string[] {
  return slotIds.map((id) => mealSlotLabelFromId(id));
}

/** Rad-etiketter i PT-ukeplanen — følger rekkefølgen på første dag i planen. */
export function getPlannerMealSlotsForPlan(plan: MealPlan): string[] {
  const day = plan.days[0];
  if (!day?.meals.length) return plannerSlotLabelsFromIds(DEFAULT_MEAL_PLAN_SLOT_IDS);
  return day.meals.map((meal) => {
    const slotId = mealNameToSlotId(meal.name);
    return slotId ? mealSlotLabelFromId(slotId) : meal.name.trim() || "Måltid";
  });
}

export function isValidMealPlanSlotSelection(slotIds: MealPlanSlotId[]): boolean {
  return slotIds.length > 0 && slotIds.every((id) => SLOT_BY_ID.has(id));
}

export function toggleMealPlanSlotId(current: MealPlanSlotId[], slotId: MealPlanSlotId): MealPlanSlotId[] {
  if (current.includes(slotId)) {
    const next = current.filter((id) => id !== slotId);
    return next.length ? next : current;
  }
  const order = MEAL_PLAN_SLOT_DEFINITIONS.map((s) => s.id);
  return [...current, slotId].sort((a, b) => order.indexOf(a) - order.indexOf(b));
}
