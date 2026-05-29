import type { FoodItem } from "./foodBankTypes";

export type FoodPortionDefault = {
  portionLabel: string;
  portionGrams: number;
};

function normalizeFoodKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/,/g, "")
    .replace(/\s+/g, " ");
}

/** Vanlige navn/varianter → hovednøkkel i FOOD_PORTION_DEFAULTS. */
const FOOD_PORTION_ALIASES: Record<string, string> = {
  skyr: "skyr naturell",
  "skyr naturell 0%": "skyr naturell",
  "skyr 0%": "skyr naturell",
  banan: "banana",
  kylling: "kyllingbryst",
  "kylling filet": "kyllingbryst",
  "laks filet": "laks",
  "torsk filet": "torsk",
  "riskaker naturell": "riskaker",
  müsli: "musli",
  "fullkornspasta": "fullkornspasta kokt",
  "pasta fullkorn kokt": "fullkornspasta kokt",
  "ris basmati kokt": "basmatiris kokt",
  "ris basmati tørr": "basmatiris tørr",
  "cottage cheese mager": "cottage cheese",
  "gresk yoghurt 0%": "gresk yoghurt",
  "yoghurt naturell 0%": "yoghurt naturell",
  "egg": "egg",
  "egg rå": "egg",
};

/** Standardporsjoner for vanlige matvarer når ingen egen porsjon er satt i matbanken. */
export const FOOD_PORTION_DEFAULTS: Record<string, FoodPortionDefault> = {
  // Proteinkilder
  kyllingbryst: { portionLabel: "150 g", portionGrams: 150 },
  "kyllinglår uten skinn": { portionLabel: "150 g", portionGrams: 150 },
  "storfekjøtt mager": { portionLabel: "150 g", portionGrams: 150 },
  laks: { portionLabel: "150 g", portionGrams: 150 },
  torsk: { portionLabel: "150 g", portionGrams: 150 },
  "tunfisk i vann": { portionLabel: "1 boks", portionGrams: 112 },
  egg: { portionLabel: "2 stk", portionGrams: 100 },
  eggewite: { portionLabel: "3 stk", portionGrams: 100 },
  "skyr naturell": { portionLabel: "1 beger", portionGrams: 130 },
  "cottage cheese": { portionLabel: "150 g", portionGrams: 150 },
  "tofu fast": { portionLabel: "150 g", portionGrams: 150 },
  kalkunkjøtt: { portionLabel: "150 g", portionGrams: 150 },
  skinke: { portionLabel: "30 g", portionGrams: 30 },
  leverpostei: { portionLabel: "20 g", portionGrams: 20 },
  reker: { portionLabel: "150 g", portionGrams: 150 },
  "svin indrefilet": { portionLabel: "150 g", portionGrams: 150 },
  "proteinpulver whey": { portionLabel: "1 scoop", portionGrams: 30 },
  "karbonadedeig mager": { portionLabel: "150 g", portionGrams: 150 },
  "makrell i tomat": { portionLabel: "1 boks", portionGrams: 170 },
  proteinbar: { portionLabel: "1 stk", portionGrams: 60 },

  // Karbohydrater
  havregryn: { portionLabel: "40 g (1 dl)", portionGrams: 40 },
  "basmatiris kokt": { portionLabel: "150 g", portionGrams: 150 },
  "basmatiris tørr": { portionLabel: "60 g", portionGrams: 60 },
  "fullkornspasta kokt": { portionLabel: "200 g", portionGrams: 200 },
  "fullkornspasta tørr": { portionLabel: "60 g", portionGrams: 60 },
  søtpotet: { portionLabel: "150 g", portionGrams: 150 },
  "potet kokt": { portionLabel: "150 g", portionGrams: 150 },
  "quinoa kokt": { portionLabel: "150 g", portionGrams: 150 },
  "bulgur kokt": { portionLabel: "150 g", portionGrams: 150 },
  "couscous kokt": { portionLabel: "150 g", portionGrams: 150 },
  rugbrød: { portionLabel: "1 skive", portionGrams: 40 },
  "grovt brød": { portionLabel: "1 skive", portionGrams: 45 },
  banana: { portionLabel: "1 stk", portionGrams: 120 },
  honning: { portionLabel: "1 ss", portionGrams: 21 },
  "bønner kidney kokt": { portionLabel: "150 g", portionGrams: 150 },
  "kikerter kokt": { portionLabel: "150 g", portionGrams: 150 },
  "linser kokt": { portionLabel: "150 g", portionGrams: 150 },
  granola: { portionLabel: "50 g", portionGrams: 50 },
  musli: { portionLabel: "50 g", portionGrams: 50 },
  riskaker: { portionLabel: "2 stk", portionGrams: 18 },

  // Fettkilder
  olivenolje: { portionLabel: "1 ss", portionGrams: 14 },
  avokado: { portionLabel: "1/2 stk", portionGrams: 100 },
  mandler: { portionLabel: "30 g", portionGrams: 30 },
  valnøtter: { portionLabel: "30 g", portionGrams: 30 },
  "peanøttsmør": { portionLabel: "1 ss", portionGrams: 16 },
  smør: { portionLabel: "1 ts", portionGrams: 5 },
  kokosolje: { portionLabel: "1 ss", portionGrams: 14 },
  chiafrø: { portionLabel: "1 ss", portionGrams: 12 },
  hummus: { portionLabel: "2 ss", portionGrams: 30 },
  "sjokolade mørk 70%": { portionLabel: "20 g", portionGrams: 20 },

  // Grønnsaker
  brokkoli: { portionLabel: "150 g", portionGrams: 150 },
  spinat: { portionLabel: "100 g", portionGrams: 100 },
  tomat: { portionLabel: "1 stk", portionGrams: 120 },
  agurk: { portionLabel: "100 g", portionGrams: 100 },
  paprika: { portionLabel: "1 stk", portionGrams: 150 },
  gulrot: { portionLabel: "100 g", portionGrams: 100 },
  squash: { portionLabel: "150 g", portionGrams: 150 },
  blomkål: { portionLabel: "150 g", portionGrams: 150 },
  asparges: { portionLabel: "150 g", portionGrams: 150 },
  rødbete: { portionLabel: "150 g", portionGrams: 150 },
  "salat mix": { portionLabel: "100 g", portionGrams: 100 },
  løk: { portionLabel: "50 g", portionGrams: 50 },
  hvitløk: { portionLabel: "1 fedd", portionGrams: 5 },
  "kyllingwok grønnsaker": { portionLabel: "200 g", portionGrams: 200 },

  // Frukt & bær
  eple: { portionLabel: "1 stk", portionGrams: 180 },
  appelsin: { portionLabel: "1 stk", portionGrams: 130 },
  blåbær: { portionLabel: "100 g", portionGrams: 100 },
  jordbær: { portionLabel: "100 g", portionGrams: 100 },
  bringebær: { portionLabel: "100 g", portionGrams: 100 },
  mango: { portionLabel: "150 g", portionGrams: 150 },
  druer: { portionLabel: "100 g", portionGrams: 100 },
  ananas: { portionLabel: "150 g", portionGrams: 150 },
  kiwi: { portionLabel: "1 stk", portionGrams: 75 },
  pære: { portionLabel: "1 stk", portionGrams: 170 },

  // Meieriprodukter
  helmelk: { portionLabel: "2 dl", portionGrams: 200 },
  lettmelk: { portionLabel: "2 dl", portionGrams: 200 },
  "skummet melk": { portionLabel: "2 dl", portionGrams: 200 },
  "yoghurt naturell": { portionLabel: "150 g", portionGrams: 150 },
  "gresk yoghurt": { portionLabel: "150 g", portionGrams: 150 },
  "fløte 38%": { portionLabel: "1 ss", portionGrams: 15 },
  mozzarella: { portionLabel: "50 g", portionGrams: 50 },
  "norvegia lett": { portionLabel: "30 g", portionGrams: 30 },
  fetaost: { portionLabel: "40 g", portionGrams: 40 },
  "rømme lett": { portionLabel: "2 ss", portionGrams: 30 },
  "iskaffe protein": { portionLabel: "330 ml", portionGrams: 330 },
};

export function isGenericDefaultPortion(food: Pick<FoodItem, "portionGrams" | "portionLabel">): boolean {
  const grams = food.portionGrams;
  const label = food.portionLabel?.trim() ?? "";
  return (!Number.isFinite(grams) || grams <= 0 || grams === 100) && (!label || label === "100 g");
}

export function knownPortionForFoodName(name: string): FoodPortionDefault | null {
  const key = normalizeFoodKey(name);
  if (FOOD_PORTION_DEFAULTS[key]) return FOOD_PORTION_DEFAULTS[key];
  const aliasKey = FOOD_PORTION_ALIASES[key];
  if (aliasKey && FOOD_PORTION_DEFAULTS[aliasKey]) return FOOD_PORTION_DEFAULTS[aliasKey];
  return null;
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
