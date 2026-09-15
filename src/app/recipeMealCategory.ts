export type RecipeMealSlot = "frokost" | "lunsj" | "middag" | "snack";

export const RECIPE_MEAL_SLOTS: { id: RecipeMealSlot; label: string }[] = [
  { id: "frokost", label: "Frokost" },
  { id: "lunsj", label: "Lunsj" },
  { id: "middag", label: "Middag" },
  { id: "snack", label: "Snack" },
];

export type RecipeMealListTab = "all" | RecipeMealSlot;

export function isRecipeMealSlot(value: unknown): value is RecipeMealSlot {
  return value === "frokost" || value === "lunsj" || value === "middag" || value === "snack";
}

function normalizeMealHaystack(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/ø/g, "o")
    .replace(/å/g, "a")
    .replace(/æ/g, "ae");
}

export function uniqueRecipeMealSlots(slots: RecipeMealSlot[]): RecipeMealSlot[] {
  const seen = new Set<RecipeMealSlot>();
  const ordered: RecipeMealSlot[] = [];
  for (const slot of RECIPE_MEAL_SLOTS) {
    if (slots.includes(slot.id) && !seen.has(slot.id)) {
      seen.add(slot.id);
      ordered.push(slot.id);
    }
  }
  return ordered;
}

export function parseRecipeMealSlots(raw: unknown, fallback?: unknown): RecipeMealSlot[] {
  if (Array.isArray(raw)) {
    return uniqueRecipeMealSlots(raw.filter(isRecipeMealSlot));
  }
  if (isRecipeMealSlot(raw)) return [raw];
  if (isRecipeMealSlot(fallback)) return [fallback];
  return [];
}

/** Gjetter ett måltid fra tag, tittel og beskrivelse når oppskriften mangler lagrede kategorier. */
export function resolveRecipeMealSlot(tag: string, title: string, description = "", extra = ""): RecipeMealSlot | null {
  const hay = normalizeMealHaystack(`${tag} · ${title} · ${description} · ${extra}`);

  if (/\bsnack\b|\bniste\b|\bmellommaltid\b|\bproteinbar\b|\bsmoothie\b/.test(hay)) return "snack";
  if (/frokost|overnight|havregr[oø]t|cottage|kesam|skyr|yoghurt|baer|kvarg/.test(hay)) return "frokost";
  if (/lunsj|wrap|salat/.test(hay)) return "lunsj";
  if (/middag|bolo|pasta|lakse|laks|steik/.test(hay)) return "middag";

  return null;
}

export function recipeMealSlotsFor(item: {
  mealSlots?: RecipeMealSlot[] | null;
  mealSlot?: RecipeMealSlot | null;
  tag: string;
  title: string;
  description?: string;
  body?: string;
}): RecipeMealSlot[] {
  const stored = uniqueRecipeMealSlots([
    ...(item.mealSlots ?? []),
    ...(isRecipeMealSlot(item.mealSlot) ? [item.mealSlot] : []),
  ]);
  if (stored.length) return stored;
  const inferred = resolveRecipeMealSlot(item.tag, item.title, item.description ?? "", item.body ?? "");
  return inferred ? [inferred] : [];
}

export function recipeMealSlotFor(
  item: {
    mealSlots?: RecipeMealSlot[] | null;
    mealSlot?: RecipeMealSlot | null;
    tag: string;
    title: string;
    description?: string;
    body?: string;
  },
  preferred?: RecipeMealSlot | null,
): RecipeMealSlot | null {
  const slots = recipeMealSlotsFor(item);
  if (preferred && slots.includes(preferred)) return preferred;
  return slots[0] ?? null;
}

export function recipeBelongsToMealSlot(
  item: {
    mealSlots?: RecipeMealSlot[] | null;
    mealSlot?: RecipeMealSlot | null;
    tag: string;
    title: string;
    description?: string;
    body?: string;
  },
  slot: RecipeMealSlot,
): boolean {
  return recipeMealSlotsFor(item).includes(slot);
}

export function mealSlotLabel(slot: RecipeMealSlot): string {
  return RECIPE_MEAL_SLOTS.find((row) => row.id === slot)?.label ?? slot;
}

export function mealSlotsLabel(slots: RecipeMealSlot[]): string {
  return slots.map(mealSlotLabel).join(", ");
}
