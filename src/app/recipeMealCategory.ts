export type RecipeMealSlot = "frokost" | "lunsj" | "middag" | "snack";

export const RECIPE_MEAL_SLOTS: { id: RecipeMealSlot; label: string }[] = [
  { id: "frokost", label: "Frokost" },
  { id: "lunsj", label: "Lunsj" },
  { id: "middag", label: "Middag" },
  { id: "snack", label: "Snack" },
];

function normalizeMealHaystack(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/ø/g, "o")
    .replace(/å/g, "a")
    .replace(/æ/g, "ae");
}

/** Plasserer oppskrift i frokost / lunsj / middag / snack ut fra tag, tittel og beskrivelse. */
export function resolveRecipeMealSlot(tag: string, title: string, description = ""): RecipeMealSlot | null {
  const hay = normalizeMealHaystack(`${tag} · ${title} · ${description}`);

  if (/\bsnack\b|\bniste\b|\bmellommaltid\b|\bproteinbar\b|\bsmoothie\b/.test(hay)) return "snack";
  if (/frokost|overnight|havregr[oø]t/.test(hay)) return "frokost";
  if (/lunsj|wrap|salat/.test(hay)) return "lunsj";
  if (/middag|bolo|pasta|lakse|laks|steik/.test(hay)) return "middag";

  return null;
}

export function mealSlotLabel(slot: RecipeMealSlot): string {
  return RECIPE_MEAL_SLOTS.find((row) => row.id === slot)?.label ?? slot;
}
