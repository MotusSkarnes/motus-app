import { defaultPortionGramsForFood, defaultPortionLabelForFood } from "./foodPortionDefaults";
import type { FoodItem } from "./foodBankTypes";

const UNIT_ALIASES: Record<string, string> = {
  skiver: "skive",
  handfull: "håndfull",
};

const PORTION_UNIT_PATTERN =
  /(\d+(?:[.,]\d+)?|\d+\s*\/\s*\d+)\s*(g|kg|dl|ss|ts|stk|skiver?|boks|fedd|håndfull|handfull)\b/gi;

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
