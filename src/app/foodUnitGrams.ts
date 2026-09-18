import { defaultPortionGramsForFood, defaultPortionLabelForFood } from "./foodPortionDefaults";
import { normalizeFoodBankNameKey } from "./foodBankNameKey";
import type { FoodItem } from "./foodBankTypes";
import unitGramsData from "./foodBankUnitGramsData.json";
import { RECIPE_INGREDIENT_UNITS } from "./recipeUnits";

const UNIT_ALIASES: Record<string, string> = {
  skiver: "skive",
  handfull: "håndfull",
  "stk (liten)": "stk liten",
  "stk (stor)": "stk stor",
  "stk (middels)": "stk",
  "glass (lite)": "glass liten",
  "glass (stort)": "glass stor",
  "boks (liten)": "boks liten",
  "pose (liten)": "pose liten",
  "pose (stor)": "pose stor",
  "plate (liten)": "plate liten",
  "plate (stor)": "plate stor",
  "plate (middels)": "plate",
  "pr brødskive": "brødskive",
};

const PORTION_UNIT_PATTERN =
  /(\d+(?:[.,]\d+)?|\d+\s*\/\s*\d+)\s*(stk liten|stk stor|glass liten|glass stor|boks liten|pose liten|pose stor|plate liten|plate stor|brødskive|håndfull|handfull|porsjon|skiver?|fedd|beger|pakke|filet|kartong|bukett|stilk|stang|terning|glass|kopp|plate|pose|boks|skive|dl|ss|ts|stk|kg|g)\b/gi;

export type FoodWithUnitGrams = Pick<FoodItem, "name" | "portionLabel" | "portionGrams"> & {
  unitGrams?: FoodItem["unitGrams"];
};

export function normalizeFoodUnit(unit: string): string {
  const trimmed = unit.trim().toLowerCase();
  return UNIT_ALIASES[trimmed] ?? trimmed;
}

function parsePortionQuantity(raw: string): number | null {
  const fraction = raw.trim().match(/^(\d+)\s*\/\s*(\d+)$/);
  if (fraction) {
    const numerator = Number.parseInt(fraction[1], 10);
    const denominator = Number.parseInt(fraction[2], 10);
    if (denominator > 0) return numerator / denominator;
    return null;
  }
  const value = Number.parseFloat(raw.replace(",", "."));
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function sanitizeUnitGrams(value: FoodItem["unitGrams"] | undefined): FoodItem["unitGrams"] | undefined {
  if (!value || typeof value !== "object") return undefined;
  const next: Record<string, number> = {};
  for (const [unit, grams] of Object.entries(value)) {
    const key = normalizeFoodUnit(unit);
    if (!key) continue;
    if (typeof grams !== "number" || !Number.isFinite(grams) || grams <= 0) continue;
    next[key] = grams;
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

export function mergeUnitGramsMaps(
  preferred?: FoodItem["unitGrams"],
  fallback?: FoodItem["unitGrams"],
): FoodItem["unitGrams"] | undefined {
  return sanitizeUnitGrams({
    ...sanitizeUnitGrams(fallback),
    ...sanitizeUnitGrams(preferred),
  });
}

/** Vekter utledet fra standardporsjonen (f.eks. 1/2 stk = 100 g → 200 g per stk). */
export function inferredUnitGramsFromPortion(food: FoodWithUnitGrams): Record<string, number> {
  const label = defaultPortionLabelForFood(food);
  const portionGrams = defaultPortionGramsForFood(food);
  if (!(portionGrams > 0) || !label.trim()) return {};

  const matches = [...label.matchAll(PORTION_UNIT_PATTERN)].flatMap((match) => {
    const quantity = parsePortionQuantity(match[1] ?? "");
    const unit = normalizeFoodUnit(match[2] ?? "");
    if (!quantity || !unit || unit === "g" || unit === "kg") return [];
    return [{ quantity, unit }];
  });

  const result: Record<string, number> = {};
  for (const match of matches) {
    const gramsPerUnit = portionGrams / match.quantity;
    if (Number.isFinite(gramsPerUnit) && gramsPerUnit > 0) {
      result[match.unit] = gramsPerUnit;
    }
  }
  return result;
}

export function registeredGramsPerUnit(food: FoodWithUnitGrams | null | undefined, unit: string): number | undefined {
  const key = normalizeFoodUnit(unit);
  if (!key) return undefined;
  if (key === "g") return 1;
  if (key === "kg") return 1000;
  if (!food) return undefined;
  const stored = sanitizeUnitGrams(food.unitGrams)?.[key];
  if (stored != null) return stored;
  const inferred = inferredUnitGramsFromPortion(food)[key];
  return inferred != null && inferred > 0 ? inferred : undefined;
}

export function hasRegisteredUnitWeight(food: FoodWithUnitGrams | null | undefined, unit: string): boolean {
  return registeredGramsPerUnit(food, unit) != null;
}

export function registeredRecipeUnitsForFood(food: FoodWithUnitGrams | null | undefined): readonly string[] {
  if (!food) return RECIPE_INGREDIENT_UNITS;
  return RECIPE_INGREDIENT_UNITS.filter((unit) => hasRegisteredUnitWeight(food, unit));
}

export function missingRecipeUnitsForFood(food: FoodWithUnitGrams | null | undefined): readonly string[] {
  if (!food) return [];
  return RECIPE_INGREDIENT_UNITS.filter((unit) => unit !== "g" && unit !== "kg" && !hasRegisteredUnitWeight(food, unit));
}

export function withRegisteredUnitGrams(food: FoodItem, unit: string, gramsPerUnit: number): FoodItem {
  const key = normalizeFoodUnit(unit);
  const grams = Number(gramsPerUnit);
  if (!key || !Number.isFinite(grams) || grams <= 0) return food;
  return {
    ...food,
    unitGrams: {
      ...sanitizeUnitGrams(food.unitGrams),
      [key]: grams,
    },
  };
}

export function parseIngredientQuantity(value: string): number {
  const parsed = Number.parseFloat(value.trim().replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function gramsForIngredientDraft(
  quantity: string,
  unit: string,
  food: FoodWithUnitGrams | null | undefined,
): number | null {
  const qty = parseIngredientQuantity(quantity);
  if (!(qty > 0)) return null;
  const perUnit = registeredGramsPerUnit(food, unit);
  return perUnit != null ? qty * perUnit : null;
}

export function formatGramsAmount(grams: number): string {
  const rounded = Math.round(grams * 10) / 10;
  if (!Number.isFinite(rounded) || rounded <= 0) return "";
  if (Math.abs(rounded - Math.round(rounded)) < 0.05) return `${Math.round(rounded)} g`;
  return `${String(rounded).replace(".", ",")} g`;
}

export type MatvaretabellenPortion = {
  id?: string;
  portionName?: string;
  quantity?: number;
  unit?: string;
};

const MATVARETABELLEN_PORTION_TO_UNIT: Record<string, string> = {
  dl: "dl",
  desiliter: "dl",
  spiseskje: "ss",
  teskje: "ts",
  stk: "stk",
  stk_middels: "stk",
  "stk (middels)": "stk",
  stk_liten: "stk liten",
  "stk (liten)": "stk liten",
  stk_stor: "stk stor",
  "stk (stor)": "stk stor",
  skive: "skive",
  boks: "boks",
  boks_liten: "boks liten",
  "boks (liten)": "boks liten",
  fedd: "fedd",
  neve: "håndfull",
  håndfull: "håndfull",
  handfull: "håndfull",
  porsjon: "porsjon",
  glass: "glass",
  glass_lite: "glass liten",
  "glass (lite)": "glass liten",
  glass_stort: "glass stor",
  "glass (stort)": "glass stor",
  kopp: "kopp",
  beger: "beger",
  pakke: "pakke",
  pose: "pose",
  pose_liten: "pose liten",
  "pose (liten)": "pose liten",
  pose_stor: "pose stor",
  "pose (stor)": "pose stor",
  pr_skive: "brødskive",
  "pr brødskive": "brødskive",
  filet: "filet",
  kartong: "kartong",
  plate: "plate",
  plate_liten: "plate liten",
  "plate (liten)": "plate liten",
  plate_stor: "plate stor",
  "plate (stor)": "plate stor",
  plate_middels: "plate",
  "plate (middels)": "plate",
  bukett: "bukett",
  blad: "blad",
  stilk: "stilk",
  stang: "stang",
  ring: "ring",
  båt: "båt",
  terning: "terning",
};

const LOOKUP_NAME_ALIASES: Record<string, string> = {
  banana: "banan",
  eggewite: "eggehvite",
};

const UNIT_GRAMS_LOOKUP = (unitGramsData as { lookup?: Record<string, Record<string, number>> }).lookup ?? {};
const UNIT_GRAMS_LOOKUP_KEYS = Object.keys(UNIT_GRAMS_LOOKUP).sort();
const UNIT_GRAMS_LOOKUP_CACHE = new Map<string, FoodItem["unitGrams"] | undefined>();

function keysStartingWith(prefix: string): string[] {
  if (!prefix) return [];
  let lo = 0;
  let hi = UNIT_GRAMS_LOOKUP_KEYS.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (UNIT_GRAMS_LOOKUP_KEYS[mid] < prefix) lo = mid + 1;
    else hi = mid;
  }
  const matches: string[] = [];
  for (let index = lo; index < UNIT_GRAMS_LOOKUP_KEYS.length; index += 1) {
    const key = UNIT_GRAMS_LOOKUP_KEYS[index];
    if (!key.startsWith(prefix)) break;
    matches.push(key);
  }
  return matches;
}

function scoreUnitGramsMatch(queryKey: string, candidateKey: string, units: Record<string, number>): number {
  const exact = candidateKey === queryKey ? 1000 : 0;
  const unitCount = Object.keys(units).length;
  const prefix = candidateKey.startsWith(queryKey)
    ? queryKey.length
    : queryKey.startsWith(candidateKey)
      ? candidateKey.length
      : 0;
  return exact + unitCount * 10 + prefix;
}

function gramsFromPortion(portion: MatvaretabellenPortion): number | null {
  const grams = Number(portion.quantity);
  if (!Number.isFinite(grams) || grams <= 0) return null;
  const unitCode = String(portion.unit ?? "g").trim().toLowerCase();
  if (unitCode && unitCode !== "g") return null;
  return grams;
}

/** Mapper Matvaretabellens porsjoner til gram per enhet i måltidsbyggeren. */
export function unitGramsFromMatvaretabellenPortions(
  portions: MatvaretabellenPortion[] | undefined,
): FoodItem["unitGrams"] | undefined {
  if (!portions?.length) return undefined;
  const exact: Record<string, number> = {};

  for (const portion of portions) {
    const grams = gramsFromPortion(portion);
    if (grams == null) continue;
    const id = String(portion.id ?? "").trim().toLowerCase();
    const name = String(portion.portionName ?? "").trim().toLowerCase();
    const mapped = MATVARETABELLEN_PORTION_TO_UNIT[id] ?? MATVARETABELLEN_PORTION_TO_UNIT[name];
    if (!mapped) continue;
    exact[mapped] = grams;
  }

  return sanitizeUnitGrams(exact);
}

function lookupKeysForName(name: string): string[] {
  const key = normalizeFoodBankNameKey(name);
  if (!key) return [];
  const keys = [key];
  const short = normalizeFoodBankNameKey(name.split(",")[0] ?? "");
  if (short) keys.push(short);
  const alias = LOOKUP_NAME_ALIASES[key] ?? LOOKUP_NAME_ALIASES[short];
  if (alias) keys.push(normalizeFoodBankNameKey(alias));
  for (const [from, to] of Object.entries(LOOKUP_NAME_ALIASES)) {
    if (to === key || to === short) keys.push(from);
  }
  return [...new Set(keys.filter(Boolean))];
}

function isTrainerCreatedFood(item: Pick<FoodItem, "isCustom" | "source">): boolean {
  return item.isCustom === true || item.source === "egen";
}

/** Kortnøkler som «brød» inni «brødkrutonger» — bare for å fjerne feilpåførte vekter. */
function reversePrefixLookupUnits(name: string): Record<string, number> | undefined {
  const key = normalizeFoodBankNameKey(name);
  if (key.length < 4) return undefined;
  for (let length = key.length - 1; length >= 3; length -= 1) {
    const prefix = key.slice(0, length);
    const units = UNIT_GRAMS_LOOKUP[prefix];
    if (units) return units;
  }
  return undefined;
}

export function lookupUnitGramsForFoodName(name: string): FoodItem["unitGrams"] | undefined {
  const cacheKey = normalizeFoodBankNameKey(name);
  if (!cacheKey) return undefined;
  if (UNIT_GRAMS_LOOKUP_CACHE.has(cacheKey)) return UNIT_GRAMS_LOOKUP_CACHE.get(cacheKey);

  const keys = lookupKeysForName(name);
  if (!keys.length) {
    UNIT_GRAMS_LOOKUP_CACHE.set(cacheKey, undefined);
    return undefined;
  }

  for (const key of keys) {
    const exact = UNIT_GRAMS_LOOKUP[key];
    if (exact) {
      const result = sanitizeUnitGrams(exact);
      UNIT_GRAMS_LOOKUP_CACHE.set(cacheKey, result);
      return result;
    }
  }

  let best: Record<string, number> | undefined;
  let bestScore = -1;
  for (const key of keys) {
    if (key.length < 4) continue;
    for (const candidateKey of keysStartingWith(key)) {
      if (candidateKey === key) continue;
      const units = UNIT_GRAMS_LOOKUP[candidateKey];
      if (!units) continue;
      const score = scoreUnitGramsMatch(key, candidateKey, units);
      if (score > bestScore) {
        best = units;
        bestScore = score;
      }
    }
  }

  const result = sanitizeUnitGrams(best);
  UNIT_GRAMS_LOOKUP_CACHE.set(cacheKey, result);
  return result;
}

export function stripContaminatedLookupUnits(item: FoodItem): FoodItem {
  const stored = sanitizeUnitGrams(item.unitGrams);
  if (!stored) return item;
  const loose = sanitizeUnitGrams(reversePrefixLookupUnits(item.name));
  if (!loose) return item;
  const strict = lookupUnitGramsForFoodName(item.name);
  const next: Record<string, number> = { ...stored };
  let changed = false;
  for (const [unit, grams] of Object.entries(loose)) {
    if (strict?.[unit] === grams) continue;
    if (next[unit] === grams) {
      delete next[unit];
      changed = true;
    }
  }
  if (!changed) return item;
  const unitGrams = sanitizeUnitGrams(next);
  return unitGrams ? { ...item, unitGrams } : { ...item, unitGrams: undefined };
}

export function enrichFoodItemUnitGrams(item: FoodItem): FoodItem {
  const cleaned = stripContaminatedLookupUnits(item);
  if (isTrainerCreatedFood(cleaned)) return cleaned;
  const unitGrams = mergeUnitGramsMaps(cleaned.unitGrams, lookupUnitGramsForFoodName(cleaned.name));
  return unitGrams ? { ...cleaned, unitGrams } : { ...cleaned, unitGrams: undefined };
}
