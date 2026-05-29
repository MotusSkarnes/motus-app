import type { FoodItem } from "./foodBankTypes";

export type FoodPortionDefault = {
  portionLabel: string;
  portionGrams: number;
};

function normalizeFoodKey(name: string): string {
  return name.trim().toLowerCase();
}

/** Standardporsjoner for vanlige matvarer når ingen egen porsjon er satt i matbanken. */
export const FOOD_PORTION_DEFAULTS: Record<string, FoodPortionDefault> = {
  "kyllingbryst": { portionLabel: "150 g", portionGrams: 150 },
  "kyllinglår uten skinn": { portionLabel: "150 g", portionGrams: 150 },
  "storfekjøtt mager": { portionLabel: "150 g", portionGrams: 150 },
  "laks": { portionLabel: "150 g", portionGrams: 150 },
  "torsk": { portionLabel: "150 g", portionGrams: 150 },
  "tunfisk i vann": { portionLabel: "1 boks", portionGrams: 112 },
  "eggewite": { portionLabel: "3 stk", portionGrams: 100 },
  "skyr naturell": { portionLabel: "1 beger", portionGrams: 130 },
  "cottage cheese": { portionLabel: "150 g", portionGrams: 150 },
  "tofu fast": { portionLabel: "150 g", portionGrams: 150 },
  "kalkunkjøtt": { portionLabel: "150 g", portionGrams: 150 },
  "reker": { portionLabel: "150 g", portionGrams: 150 },
  "svin indrefilet": { portionLabel: "150 g", portionGrams: 150 },
  "karbonadedeig mager": { portionLabel: "150 g", portionGrams: 150 },
  "havregryn": { portionLabel: "40 g (1 dl)", portionGrams: 40 },
  "basmatiris kokt": { portionLabel: "150 g", portionGrams: 150 },
  "basmatiris tørr": { portionLabel: "60 g", portionGrams: 60 },
  "fullkornspasta kokt": { portionLabel: "200 g", portionGrams: 200 },
  "søtpotet": { portionLabel: "150 g", portionGrams: 150 },
  "potet kokt": { portionLabel: "150 g", portionGrams: 150 },
  "quinoa kokt": { portionLabel: "150 g", portionGrams: 150 },
  "bulgur kokt": { portionLabel: "150 g", portionGrams: 150 },
  "couscous kokt": { portionLabel: "150 g", portionGrams: 150 },
  "bønner kidney kokt": { portionLabel: "150 g", portionGrams: 150 },
  "kikerter kokt": { portionLabel: "150 g", portionGrams: 150 },
  "linser kokt": { portionLabel: "150 g", portionGrams: 150 },
  "brokkoli": { portionLabel: "150 g", portionGrams: 150 },
  "spinat": { portionLabel: "100 g", portionGrams: 100 },
  "tomat": { portionLabel: "1 stk", portionGrams: 120 },
  "agurk": { portionLabel: "100 g", portionGrams: 100 },
  "paprika": { portionLabel: "1 stk", portionGrams: 150 },
  "gulrot": { portionLabel: "100 g", portionGrams: 100 },
  "squash": { portionLabel: "150 g", portionGrams: 150 },
  "blomkål": { portionLabel: "150 g", portionGrams: 150 },
  "asparges": { portionLabel: "150 g", portionGrams: 150 },
  "rødbete": { portionLabel: "150 g", portionGrams: 150 },
  "salat mix": { portionLabel: "100 g", portionGrams: 100 },
  "løk": { portionLabel: "50 g", portionGrams: 50 },
  "hvitløk": { portionLabel: "1 fedd", portionGrams: 5 },
  "blåbær": { portionLabel: "100 g", portionGrams: 100 },
  "jordbær": { portionLabel: "100 g", portionGrams: 100 },
  "bringebær": { portionLabel: "100 g", portionGrams: 100 },
  "mango": { portionLabel: "150 g", portionGrams: 150 },
  "druer": { portionLabel: "100 g", portionGrams: 100 },
  "ananas": { portionLabel: "150 g", portionGrams: 150 },
  "kiwi": { portionLabel: "1 stk", portionGrams: 75 },
  "pære": { portionLabel: "1 stk", portionGrams: 170 },
  "yoghurt naturell": { portionLabel: "150 g", portionGrams: 150 },
  "gresk yoghurt": { portionLabel: "150 g", portionGrams: 150 },
  "kyllingwok grønnsaker": { portionLabel: "200 g", portionGrams: 200 },
};

export function isGenericDefaultPortion(food: Pick<FoodItem, "portionGrams" | "portionLabel">): boolean {
  const grams = food.portionGrams;
  const label = food.portionLabel?.trim() ?? "";
  return (!Number.isFinite(grams) || grams <= 0 || grams === 100) && (!label || label === "100 g");
}

export function knownPortionForFoodName(name: string): FoodPortionDefault | null {
  return FOOD_PORTION_DEFAULTS[normalizeFoodKey(name)] ?? null;
}

export function defaultPortionGramsForFood(
  food: Pick<FoodItem, "name" | "portionGrams" | "portionLabel"> | null | undefined,
): number {
  if (!food) return 100;
  if (!isGenericDefaultPortion(food)) {
    return Number.isFinite(food.portionGrams) && food.portionGrams > 0 ? Math.round(food.portionGrams) : 100;
  }
  const known = knownPortionForFoodName(food.name);
  return known?.portionGrams ?? 100;
}

export function defaultPortionLabelForFood(
  food: Pick<FoodItem, "name" | "portionGrams" | "portionLabel"> | null | undefined,
): string {
  if (!food) return "100 g";
  if (!isGenericDefaultPortion(food) && food.portionLabel?.trim()) {
    return food.portionLabel.trim();
  }
  const known = knownPortionForFoodName(food.name);
  if (known) return known.portionLabel;
  const grams = defaultPortionGramsForFood(food);
  return `${grams} g`;
}

export function applyKnownPortionDefaults(item: FoodItem): FoodItem {
  if (!isGenericDefaultPortion(item)) return item;
  const known = knownPortionForFoodName(item.name);
  if (!known) return item;
  return {
    ...item,
    portionLabel: known.portionLabel,
    portionGrams: known.portionGrams,
  };
}
