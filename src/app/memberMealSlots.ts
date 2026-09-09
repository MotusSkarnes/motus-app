import { mealNameToSlotId, type MealPlanSlotId } from "./mealPlanMealSlots";

export type MemberMealSlot = {
  id: string;
  label: string;
};

/** Standard måltidsplasser når medlem logger uten PT-matplan. */
export const MEMBER_MEAL_SLOTS: MemberMealSlot[] = [
  { id: "member-frokost", label: "Frokost" },
  { id: "member-lunsj", label: "Lunsj" },
  { id: "member-middag", label: "Middag" },
  { id: "member-kvelds", label: "Kvelds" },
  { id: "member-mellommaltid", label: "Mellommåltid" },
];

const PLAN_SLOT_TO_MEMBER: Record<MealPlanSlotId, MemberMealSlot["id"]> = {
  frokost: "member-frokost",
  lunsj: "member-lunsj",
  middag: "member-middag",
  kvelds: "member-kvelds",
  mellommaltid: "member-mellommaltid",
};

const SLOT_BY_ID = new Map(MEMBER_MEAL_SLOTS.map((slot) => [slot.id, slot]));

export function memberMealSlotLabel(mealId: string | undefined | null): string {
  const id = mealId?.trim() ?? "";
  if (!id) return "Annet";
  return SLOT_BY_ID.get(id)?.label ?? "Annet";
}

export function isMemberMealSlotId(mealId: string | undefined | null): boolean {
  const id = mealId?.trim() ?? "";
  return Boolean(id && SLOT_BY_ID.has(id));
}

/** Empty select value = "Annet" (no member slot). Do not default unknown ids to frokost. */
export const MEMBER_MEAL_SLOT_OTHER_ID = "";

/**
 * Value for the food-log meal-slot <select>. PT plan ids such as meal-0-frokost
 * map to member-frokost for display; unknown/empty ids stay as Annet.
 */
export function resolveMemberMealSlotSelectValue(
  mealId?: string | null,
  mealNameOrLabel?: string | null,
): string {
  const raw = mealId?.trim() ?? "";
  if (isMemberMealSlotId(raw)) return raw;
  const canonical = canonicalMemberMealSlotId(raw, mealNameOrLabel);
  if (canonical && isMemberMealSlotId(canonical)) return canonical;
  return MEMBER_MEAL_SLOT_OTHER_ID;
}

/**
 * Persist the original meal id when the user did not pick a different slot.
 * Otherwise meal-plan extra logs (meal-0-frokost) would be rewritten to
 * member-frokost and vanish from the plan meal card on gram-only edits.
 */
export function persistMemberMealSlotAfterEdit(
  originalMealId: string | undefined,
  selectedSlotId: string,
  mealNameOrLabel?: string | null,
): string | undefined {
  const selected = selectedSlotId.trim();
  const originalResolved = resolveMemberMealSlotSelectValue(originalMealId, mealNameOrLabel);
  if (selected === originalResolved) {
    const original = originalMealId?.trim();
    return original || undefined;
  }
  return selected || undefined;
}

/** PT-matplan bruker meal-0-lunsj — medlemslogging bruker member-lunsj. */
export function canonicalMemberMealSlotId(
  mealSlotId?: string | null,
  mealNameOrLabel?: string | null,
): string | undefined {
  const id = mealSlotId?.trim() ?? "";
  if (isMemberMealSlotId(id)) return id;

  const hint = `${id} ${mealNameOrLabel ?? ""}`.trim();
  const planSlot = mealNameToSlotId(hint);
  if (planSlot) return PLAN_SLOT_TO_MEMBER[planSlot];

  const suffixMatch = id.match(/meal-\d+-([a-z]+)$/i)?.[1];
  if (suffixMatch && suffixMatch in PLAN_SLOT_TO_MEMBER) {
    return PLAN_SLOT_TO_MEMBER[suffixMatch as MealPlanSlotId];
  }

  return id || undefined;
}

export function memberMealSlotsMatch(
  savedSlotId: string | undefined,
  savedName: string | undefined,
  activeSlotId: string,
): boolean {
  if (!savedSlotId?.trim()) return true;
  const active = canonicalMemberMealSlotId(activeSlotId) ?? activeSlotId.trim();
  const saved = canonicalMemberMealSlotId(savedSlotId, savedName);
  if (saved && active) return saved === active;
  return savedSlotId.trim() === activeSlotId.trim();
}
