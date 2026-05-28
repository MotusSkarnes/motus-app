import { DEFAULT_RECIPE_BODY_BY_ID } from "./defaultInspirationRecipes";
import { EMPTY_MICRONUTRIENTS, type FoodMicronutrients } from "./foodBankMicronutrients";
import { buildDefaultFoodBankItems } from "./foodBankSeed";
import { computeMacrosForGrams, type MacroTotals } from "./mealPlanMacros";
import type { FoodCategoryId, FoodItem, FoodNutrition } from "./foodBankTypes";

export type RecipeMacroResult = {
  perServing: MacroTotals;
  perServingMicronutrients: FoodMicronutrients;
  servings: number;
  matchedCount: number;
  ingredientCount: number;
};

export type RecipeIngredient = {
  key: string;
  sourceLine: string;
  displayAmount: string;
  foodId: string;
  foodName: string;
  category: FoodCategoryId;
  grams: number;
  macros: MacroTotals;
  nutritionPer100g: FoodNutrition;
};

type SyntheticFood = { name: string; nutritionPer100g: FoodNutrition };

/** Næringsverdier for vanlige oppskriftsingredienser som ikke finnes i standardbanken. */
const SYNTHETIC_FOODS: SyntheticFood[] = [
  {
    name: "fullkornspasta tørr",
    nutritionPer100g: { kcal: 348, protein: 13, carbs: 66, fat: 2.5, fiber: 8, sugar: 2, saturatedFat: 0.4, sodium: 5 },
  },
  {
    name: "fullkornstortilla",
    nutritionPer100g: { kcal: 290, protein: 9, carbs: 48, fat: 6, fiber: 6, sugar: 2, saturatedFat: 1, sodium: 520 },
  },
  {
    name: "hakkede tomater",
    nutritionPer100g: { kcal: 32, protein: 1.5, carbs: 5, fat: 0.2, fiber: 1.2, sugar: 4, saturatedFat: 0, sodium: 200 },
  },
  {
    name: "tomatpuré",
    nutritionPer100g: { kcal: 82, protein: 4.3, carbs: 18, fat: 0.5, fiber: 4, sugar: 12, saturatedFat: 0.1, sodium: 400 },
  },
  {
    name: "parmesan",
    nutritionPer100g: { kcal: 392, protein: 35, carbs: 3, fat: 26, fiber: 0, sugar: 0, saturatedFat: 17, sodium: 1200 },
  },
  {
    name: "sitron",
    nutritionPer100g: { kcal: 29, protein: 1.1, carbs: 9, fat: 0.3, fiber: 2.8, sugar: 2.5, saturatedFat: 0, sodium: 2 },
  },
];

const SYNTHETIC_BY_KEY = new Map(
  SYNTHETIC_FOODS.flatMap((row) => [
    [normalizeFoodKey(row.name), row],
    ...aliasKeysFor(row.name).map((key) => [key, row] as const),
  ]),
);

/** Søkenøkkel → matvarenavn i banken (delstreng). */
const FOOD_ALIASES: Record<string, string> = {
  havregryn: "havregryn",
  melk: "lettmelk",
  havredrikk: "lettmelk",
  banan: "banana",
  peanottsmor: "peanøttsmør",
  honning: "honning",
  lonnesirup: "honning",
  egg: "egg",
  smor: "smør",
  avokado: "avokado",
  grovbrod: "grovt brød",
  brød: "grovt brød",
  rugbrød: "rugbrød",
  riskaker: "riskaker",
  ost: "norvegia lett",
  gulost: "norvegia lett",
  norvegia: "norvegia lett",
  skinke: "skinke",
  leverpostei: "leverpostei",
  musli: "müsli",
  muesli: "müsli",
  skyr: "skyr naturell",
  cottage: "cottage cheese",
  salat: "salat mix",
  kyllingfilet: "kyllingbryst",
  kylling: "kyllingbryst",
  hummus: "hummus",
  spinat: "spinat",
  ruccola: "salat mix",
  paprika: "paprika",
  agurk: "agurk",
  kjottdeig: "karbonadedeig",
  lok: "løk",
  rodlog: "løk",
  hvitlok: "hvitløk",
  gulrot: "gulrot",
  tomat: "tomat",
  hakkedetomater: "hakkede tomater",
  tomatpure: "tomatpuré",
  fullkornspasta: "fullkornspasta tørr",
  pasta: "fullkornspasta tørr",
  parmesan: "parmesan",
  laks: "laks",
  laksefilet: "laks",
  sotpotet: "søtpotet",
  potet: "potet kokt",
  ris: "basmatiris tørr",
  tørrris: "basmatiris tørr",
  brokkoli: "brokkoli",
  tunfisk: "tunfisk i vann",
  bonner: "bønner kidney",
  cannellini: "bønner kidney",
  lima: "bønner kidney",
  hvite: "bønner kidney",
  cherrytomater: "tomat",
  olivenolje: "olivenolje",
  sitron: "sitron",
  sitronsaft: "sitron",
  saft: "sitron",
  tortill: "fullkornstortilla",
  gresk: "gresk yoghurt",
  yoghurt: "gresk yoghurt",
  notter: "mandler",
  baer: "blåbær",
};

const NEGLIGIBLE_PATTERN =
  /^(kanel|salt|pepper|chiliflak|gresslok|persille|basilikum|dill|oregano|paprikakrydder|sukker|valgfritt)/i;

function isNegligibleIngredientLine(line: string): boolean {
  const withoutQty = line
    .replace(/^(\d+(?:[.,]\d+)?(?:\s*\/\s*\d+)?)\s*(?:dl|ss|ts|kg|g|stk|skiver?|boks|fedd|håndfull|handfull|lite|stor)?\s*/i, "")
    .trim();
  return NEGLIGIBLE_PATTERN.test(line) || NEGLIGIBLE_PATTERN.test(withoutQty);
}

function aliasKeysFor(name: string): string[] {
  const key = normalizeFoodKey(name);
  if (key.includes("pasta")) return ["fullkornspasta", "pasta"];
  if (key.includes("tortilla")) return ["tortill"];
  if (key.includes("tomat") && key.includes("hakk")) return ["hakkede", "boks"];
  return [];
}

function normalizeFoodKey(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9æøå]+/g, "")
    .replace(/ø/g, "o")
    .replace(/å/g, "a")
    .replace(/æ/g, "ae");
}

export function parseRecipeServings(body: string): number {
  const match = body.match(/\*\*Til\s+(\d+)\s+porsjon/i) ?? body.match(/Til\s+(\d+)\s+porsjon/i);
  const n = match ? Number.parseInt(match[1], 10) : 1;
  return Number.isFinite(n) && n > 0 ? n : 1;
}

const INGREDIENT_SECTION_MARKER =
  /\*\*Ingredienser\*\*|(?:^|\n)#{1,3}\s*Ingredienser\b|(?:^|\n)Ingredienser\s*:?\s*(?:\n|$)/i;

export function extractRecipeIngredientLines(body: string): string[] {
  const normalized = body.replace(/\r\n/g, "\n");
  const marker = normalized.match(INGREDIENT_SECTION_MARKER);
  if (!marker || marker.index === undefined) return [];
  const after = normalized.slice(marker.index + marker[0].length);
  const nextSection = after.search(/\n(?:\*\*[^*]+\*\*|#{1,3}\s+\S+|Slik gjør du\b|Fremgangsmåte\b|Fremgangsmate\b)/i);
  const section = nextSection >= 0 ? after.slice(0, nextSection) : after;
  return section
    .split("\n")
    .map((line) => line.trim())
    .map((line) => line.replace(/^[-*•]\s+/, "").replace(/^\d+[\).]\s+/, "").trim())
    .filter(
      (line) =>
        line.length > 0 &&
        !/^slik gjør du\b/i.test(line) &&
        !/^fremgangsmate\b/i.test(line) &&
        !/^tips\b/i.test(line) &&
        !isNegligibleIngredientLine(line) &&
        !/\(valgfritt\)/i.test(line),
    );
}

function parseLeadingQuantity(raw: string): { quantity: number; rest: string } | null {
  const wordQuantity = raw.match(/^(en|ei|et|ett)\s+/i);
  if (wordQuantity) {
    return { quantity: 1, rest: raw.slice(wordQuantity[0].length).trim() };
  }

  const fraction = raw.match(/^(\d+)\s*\/\s*(\d+)\s+/);
  if (fraction) {
    const num = Number.parseInt(fraction[1], 10);
    const den = Number.parseInt(fraction[2], 10);
    if (den > 0) {
      return { quantity: num / den, rest: raw.slice(fraction[0].length).trim() };
    }
  }

  const range = raw.match(/^(\d+(?:[.,]\d+)?)\s*[–-]\s*(\d+(?:[.,]\d+)?)\s+/);
  if (range) {
    const a = Number.parseFloat(range[1].replace(",", "."));
    const b = Number.parseFloat(range[2].replace(",", "."));
    return { quantity: (a + b) / 2, rest: raw.slice(range[0].length).trim() };
  }

  const simple = raw.match(/^(\d+(?:[.,]\d+)?)\s+/);
  if (simple) {
    return {
      quantity: Number.parseFloat(simple[1].replace(",", ".")),
      rest: raw.slice(simple[0].length).trim(),
    };
  }

  const trailing = raw.match(/^(.+?)\s+(\d+(?:[.,]\d+)?)$/);
  if (trailing) {
    const quantity = Number.parseFloat(trailing[2].replace(",", "."));
    if (Number.isFinite(quantity) && quantity > 0) {
      return { quantity, rest: trailing[1].trim() };
    }
  }

  return null;
}

export type ParsedIngredient = {
  searchText: string;
  grams?: number;
  quantity?: number;
  unit?: string;
};

export function parseIngredientLine(line: string): ParsedIngredient | null {
  let text = line.trim();
  if (!text) return null;

  const juiceFrom = text.match(/^saft\s+fra\s+(.+)$/i);
  if (juiceFrom) {
    return parseIngredientLine(juiceFrom[1].trim());
  }

  text = text
    .replace(/^(revet|fersk)\s+/i, "")
    .replace(/\s+til\s+servering.*$/i, "")
    .replace(/,?\s*(og\s+)?frisk\s+basilikum.*$/i, "")
    .trim();

  if (/^sitron\b/i.test(text) && /(salt|pepper|dill)/i.test(text)) {
    return { searchText: "sitron", quantity: 0.5, unit: "stk" };
  }

  if (/parmesan/i.test(text) && !/^\d/.test(text)) {
    return { searchText: "parmesan", grams: 15 };
  }

  let explicitGrams: number | null = null;
  const perPiece = text.match(/\(ca\.?\s*(\d+(?:[.,]\d+)?)\s*g\s*per\s*stk/i);
  if (perPiece) {
    explicitGrams = Number.parseFloat(perPiece[1].replace(",", "."));
  }

  const parenGrams = text.match(/\(ca\.?\s*(\d+(?:[.,]\d+)?)\s*g\)/i);
  if (parenGrams && !perPiece) {
    explicitGrams = Number.parseFloat(parenGrams[1].replace(",", "."));
  }

  text = text.replace(/\([^)]*\)/g, "").trim();

  const inlineGrams = text.match(/(\d+(?:[.,]\d+)?)\s*g\b/i);
  if (inlineGrams && !explicitGrams) {
    explicitGrams = Number.parseFloat(inlineGrams[1].replace(",", "."));
    text = text.replace(inlineGrams[0], "").trim();
  }

  const parsed = parseLeadingQuantity(text);
  if (!parsed && !explicitGrams) return null;

  const unitMatch = parsed?.rest.match(/^(dl|ss|ts|kg|g|stk|skiver?|boks|fedd|håndfull|handfull|lite|stor)\b\s*/i);
  const unit = unitMatch?.[1]?.toLowerCase() ?? "";
  const searchText = (
    parsed ? (unitMatch ? parsed.rest.slice(unitMatch[0].length) : parsed.rest) : text
  ).trim();

  if (!searchText) return null;

  if (explicitGrams && explicitGrams > 0) {
    const qty = parsed?.quantity ?? 1;
    return { searchText, grams: explicitGrams * (perPiece ? qty : 1) };
  }

  if (!parsed) return null;

  return { searchText, quantity: parsed.quantity, unit };
}

function convertQuantityToGrams(
  quantity: number,
  unit: string,
  searchText: string,
  food: FoodItem | SyntheticFood | null,
): number {
  const key = normalizeFoodKey(searchText);

  if (unit === "g") return quantity;
  if (unit === "kg") return quantity * 1000;

  if (unit === "dl") {
    if (key.includes("havregryn")) return quantity * 40;
    if (key.includes("melk") || key.includes("drikk")) return quantity * 100;
    return quantity * 90;
  }

  if (unit === "ss") {
    if (food && "portionLabel" in food && food.portionLabel?.includes("ss") && food.portionGrams) {
      return quantity * food.portionGrams;
    }
    return quantity * 15;
  }

  if (unit === "ts") return quantity * 5;

  if (unit === "skive" || unit === "skiver") {
    const perSlice = food && "portionGrams" in food && food.portionGrams ? food.portionGrams : 45;
    return quantity * perSlice;
  }

  if (unit === "boks") {
    if (key.includes("tunfisk")) return quantity * 120;
    if (key.includes("tomat")) return quantity * 400;
    if (key.includes("bonn")) return quantity * 240;
    return quantity * 200;
  }

  if (unit === "håndfull" || unit === "handfull") return quantity * 30;
  if (unit === "fedd") return quantity * 5;

  if (unit === "lite" && key.includes("brokkoli")) return quantity * 350;
  if (unit === "stor" && key.includes("sotpotet")) return quantity * 300;

  if (unit === "stk" || !unit) {
    if (food && "portionGrams" in food && food.portionGrams) {
      const label = food.portionLabel ?? "";
      const countMatch = label.match(/(\d+)\s*stk/i);
      const perPiece = countMatch
        ? food.portionGrams / Number.parseInt(countMatch[1], 10)
        : food.portionGrams;
      return quantity * perPiece;
    }
    if (key.includes("egg")) return quantity * 50;
    if (key.includes("banan")) return quantity * 120;
    if (key.includes("avokado")) return quantity * 100;
    if (key.includes("laksefilet") || key.includes("laks")) return quantity * 150;
    if (key.includes("tortill")) return quantity * 65;
    if (key.includes("sitron")) return quantity * 40;
    return quantity * 80;
  }

  return quantity * 80;
}

function resolveFoodForIngredient(
  searchText: string,
  foodItems: FoodItem[],
): FoodItem | SyntheticFood | null {
  const synthetic = lookupSynthetic(searchText);
  if (synthetic) return synthetic;

  const bankMatch = lookupFoodBankItem(searchText, foodItems);
  if (bankMatch) return bankMatch;

  return lookupSynthetic(searchText);
}

function lookupSynthetic(searchText: string): SyntheticFood | null {
  const key = normalizeFoodKey(searchText);
  for (const [aliasKey, target] of Object.entries(FOOD_ALIASES)) {
    if (key.includes(aliasKey) && SYNTHETIC_BY_KEY.has(normalizeFoodKey(target))) {
      return SYNTHETIC_BY_KEY.get(normalizeFoodKey(target)) ?? null;
    }
  }
  const direct = SYNTHETIC_BY_KEY.get(key);
  if (direct) return direct;
  for (const [synKey, row] of SYNTHETIC_BY_KEY) {
    if (key.includes(synKey) || synKey.includes(key)) return row;
  }
  return null;
}

function lookupFoodBankItem(searchText: string, foodItems: FoodItem[]): FoodItem | null {
  const key = normalizeFoodKey(searchText);

  if (key.includes("eller")) {
    for (const part of searchText.split(/\s+eller\s+/i)) {
      const hit = lookupFoodBankItem(part.trim(), foodItems);
      if (hit) return hit;
    }
  }

  const exact = foodItems.find((item) => normalizeFoodKey(item.name) === key);
  if (exact) return exact;

  for (const [aliasKey, targetName] of Object.entries(FOOD_ALIASES)) {
    if (key.includes(aliasKey)) {
      const normalizedTarget = normalizeFoodKey(targetName);
      const hit = foodItems.find((item) => normalizeFoodKey(item.name).includes(normalizedTarget));
      if (hit) return hit;
      const synthetic = SYNTHETIC_BY_KEY.get(normalizedTarget);
      if (synthetic) return synthetic;
    }
  }

  let best: FoodItem | null = null;
  let bestScore = 0;
  const tokens = key.split(/\s+/).filter((t) => t.length > 2);

  for (const item of foodItems) {
    const itemKey = normalizeFoodKey(item.name);
    let score = 0;
    for (const token of tokens) {
      if (itemKey.includes(token)) score += token.length;
    }
    if (itemKey.includes(key) || key.includes(itemKey)) score += 4;
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }

  return bestScore >= 4 ? best : null;
}

function foodRowId(food: FoodItem | SyntheticFood): string {
  return "id" in food ? food.id : `synthetic:${normalizeFoodKey(food.name)}`;
}

function foodRowCategory(food: FoodItem | SyntheticFood): FoodCategoryId {
  if ("category" in food) return food.category;
  if (normalizeFoodKey(food.name).includes("pasta") || normalizeFoodKey(food.name).includes("ris")) {
    return "karbohydrater";
  }
  return "karbohydrater";
}

function formatQuantity(value: number): string {
  if (Math.abs(value - Math.round(value)) < 0.05) return String(Math.round(value));
  return value.toFixed(1).replace(".", ",");
}

const UNIT_LABELS: Record<string, string> = {
  dl: "dl",
  ss: "ss",
  ts: "ts",
  kg: "kg",
  g: "g",
  stk: "stk",
  skive: "skive",
  skiver: "skiver",
  boks: "boks",
  fedd: "fedd",
  håndfull: "håndfull",
  handfull: "håndfull",
  lite: "lite",
  stor: "stor",
};

export function formatIngredientDisplay(
  parsed: ParsedIngredient,
  grams: number,
  foodName: string,
): string {
  if (parsed.quantity != null && parsed.unit) {
    const unit = UNIT_LABELS[parsed.unit] ?? parsed.unit;
    return `${formatQuantity(parsed.quantity)} ${unit} ${foodName}`;
  }
  if (parsed.grams != null && parsed.grams > 0 && !parsed.quantity) {
    return `${formatQuantity(parsed.grams)} g ${foodName}`;
  }
  return `${Math.round(grams)} g ${foodName}`;
}

export function computeRecipeIngredients(body: string, foodItems: FoodItem[]): RecipeIngredient[] {
  const lines = extractRecipeIngredientLines(body);
  const rows: RecipeIngredient[] = [];

  lines.forEach((line, index) => {
    const parsed = parseIngredientLine(line);
    if (!parsed) return;

    const food = resolveFoodForIngredient(parsed.searchText, foodItems);
    if (!food) return;

    const grams =
      parsed.grams ??
      (parsed.quantity != null
        ? convertQuantityToGrams(parsed.quantity, parsed.unit ?? "", parsed.searchText, food)
        : 0);
    if (grams <= 0) return;

    const name = food.name;
    rows.push({
      key: `ing-${index}`,
      sourceLine: line,
      displayAmount: formatIngredientDisplay(parsed, grams, name),
      foodId: foodRowId(food),
      foodName: name,
      category: foodRowCategory(food),
      grams,
      macros: computeMacrosForGrams(food.nutritionPer100g, grams),
      nutritionPer100g: food.nutritionPer100g,
    });
  });

  return rows;
}

/** Bytter inn standard oppskriftstekst når lagret versjon mangler ingrediensliste som kan beregnes. */
export function applyCanonicalRecipeBodies<T extends { id: string; category?: string; body: string }>(
  items: T[],
  canonicalBodies: ReadonlyMap<string, string> = DEFAULT_RECIPE_BODY_BY_ID,
  foodItems?: FoodItem[],
): T[] {
  const foods = foodItems ?? buildDefaultFoodBankItems();
  return items.map((item) => {
    if (item.category && item.category !== "recipes") return item;
    const body = item.body.trim();
    if (body && computeRecipeMacros(body, foods)) return item;
    const canonical = canonicalBodies.get(item.id);
    if (!canonical || canonical === body) return item;
    if (!computeRecipeMacros(canonical, foods)) return item;
    return { ...item, body: canonical };
  });
}

export function computeRecipeMacros(body: string, foodItems: FoodItem[]): RecipeMacroResult | null {
  const lines = extractRecipeIngredientLines(body);
  if (lines.length === 0) return null;

  const ingredients = computeRecipeIngredients(body, foodItems);
  if (ingredients.length === 0) return null;

  const servings = parseRecipeServings(body);
  const totals = ingredients.reduce(
    (acc, row) => ({
      kcal: acc.kcal + row.macros.kcal,
      protein: acc.protein + row.macros.protein,
      carbs: acc.carbs + row.macros.carbs,
      fat: acc.fat + row.macros.fat,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );
  const micronutrientTotals = ingredients.reduce((acc, row) => {
    const micros = row.nutritionPer100g.micronutrients;
    if (!micros) return acc;
    const factor = row.grams / 100;
    for (const key of Object.keys(acc) as (keyof FoodMicronutrients)[]) {
      acc[key] += (micros[key] ?? 0) * factor;
    }
    return acc;
  }, { ...EMPTY_MICRONUTRIENTS });

  return {
    perServing: {
      kcal: totals.kcal / servings,
      protein: totals.protein / servings,
      carbs: totals.carbs / servings,
      fat: totals.fat / servings,
    },
    perServingMicronutrients: Object.fromEntries(
      (Object.keys(micronutrientTotals) as (keyof FoodMicronutrients)[]).map((key) => [
        key,
        micronutrientTotals[key] / servings,
      ]),
    ) as FoodMicronutrients,
    servings,
    matchedCount: ingredients.length,
    ingredientCount: lines.length,
  };
}
