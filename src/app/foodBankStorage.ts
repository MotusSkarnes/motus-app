import { normalizeMicronutrients } from "./foodBankMicronutrients";
import { buildDefaultFoodBankItems } from "./foodBankSeed";
import type { FoodItem, FoodNutrition } from "./foodBankTypes";

function normalizeFoodNutrition(nutrition: FoodNutrition): FoodNutrition {
  return {
    ...nutrition,
    micronutrients: normalizeMicronutrients(nutrition.micronutrients),
  };
}

function normalizeFoodItem(item: FoodItem): FoodItem {
  return {
    ...item,
    nutritionPer100g: normalizeFoodNutrition(item.nutritionPer100g),
  };
}

function normalizeFoodNameKey(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function itemQualityScore(item: FoodItem): number {
  let score = 0;
  // Keep trainer-maintained variants over raw shared rows.
  if (item.isCustom) score += 100;
  if (item.isEdited) score += 50;
  if (item.source === "egen") score += 20;
  const micros = item.nutritionPer100g.micronutrients;
  if (micros && Object.values(micros).some((v) => v > 0)) score += 10;
  const macroSum =
    (item.nutritionPer100g.kcal || 0) +
    (item.nutritionPer100g.protein || 0) +
    (item.nutritionPer100g.carbs || 0) +
    (item.nutritionPer100g.fat || 0);
  if (macroSum > 0) score += 5;
  return score;
}

function isNewerItem(next: FoodItem, current: FoodItem): boolean {
  const nextMs = Date.parse(next.createdAt ?? "") || 0;
  const currentMs = Date.parse(current.createdAt ?? "") || 0;
  return nextMs > currentMs;
}

export function dedupeFoodBankItems(items: FoodItem[]): FoodItem[] {
  const byId = new Map<string, FoodItem>();
  for (const raw of items) {
    const item = normalizeFoodItem(raw);
    const id = item.id?.trim();
    if (!id) continue;
    byId.set(id, item);
  }

  const byName = new Map<string, FoodItem>();
  for (const item of byId.values()) {
    const nameKey = normalizeFoodNameKey(item.name);
    if (!nameKey) continue;
    const current = byName.get(nameKey);
    if (!current) {
      byName.set(nameKey, item);
      continue;
    }
    const nextScore = itemQualityScore(item);
    const currentScore = itemQualityScore(current);
    if (nextScore > currentScore || (nextScore === currentScore && isNewerItem(item, current))) {
      byName.set(nameKey, item);
    }
  }

  return Array.from(byName.values());
}

export const FOOD_BANK_STORAGE_KEY = "motus_food_bank_v1";
export const FOOD_BANK_FAVORITES_KEY = "motus_food_bank_favorites_v1";
export const FOOD_BANK_RECENT_KEY = "motus_food_bank_recent_v1";
export const FOOD_BANK_CHANGED_EVENT = "motus-food-bank-changed";

function readJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function notifyFoodBankChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(FOOD_BANK_CHANGED_EVENT));
}

export function loadFoodBankItems(): FoodItem[] {
  const stored = readJson<FoodItem[]>(FOOD_BANK_STORAGE_KEY);
  if (stored?.length) {
    const deduped = dedupeFoodBankItems(stored);
    if (deduped.length !== stored.length) {
      persistFoodBankItems(deduped);
    }
    return deduped;
  }
  const seeded = buildDefaultFoodBankItems();
  persistFoodBankItems(seeded);
  return seeded;
}

export function persistFoodBankItems(items: FoodItem[]): void {
  const deduped = dedupeFoodBankItems(items);
  writeJson(FOOD_BANK_STORAGE_KEY, deduped);
  notifyFoodBankChanged();
}

export function loadFavoriteFoodIds(): string[] {
  return readJson<string[]>(FOOD_BANK_FAVORITES_KEY) ?? [];
}

export function persistFavoriteFoodIds(ids: string[]): void {
  const validIds = new Set(loadFoodBankItems().map((item) => item.id));
  const filtered = ids.filter((id) => validIds.has(id));
  writeJson(FOOD_BANK_FAVORITES_KEY, filtered);
  notifyFoodBankChanged();
}

export function loadRecentFoodIds(): string[] {
  return readJson<string[]>(FOOD_BANK_RECENT_KEY) ?? [];
}

export function persistRecentFoodIds(ids: string[]): void {
  const validIds = new Set(loadFoodBankItems().map((item) => item.id));
  const filtered = ids.filter((id) => validIds.has(id));
  writeJson(FOOD_BANK_RECENT_KEY, filtered);
  notifyFoodBankChanged();
}

export function touchRecentFoodId(foodId: string): string[] {
  const next = [foodId, ...loadRecentFoodIds().filter((id) => id !== foodId)].slice(0, 12);
  persistRecentFoodIds(next);
  return next;
}

export function upsertFoodItem(items: FoodItem[], nextItem: FoodItem): FoodItem[] {
  const index = items.findIndex((item) => item.id === nextItem.id);
  if (index === -1) return [nextItem, ...items];
  const copy = [...items];
  copy[index] = nextItem;
  return copy;
}

export function deleteFoodItem(items: FoodItem[], foodId: string): FoodItem[] {
  return items.filter((item) => item.id !== foodId);
}
