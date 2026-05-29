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
