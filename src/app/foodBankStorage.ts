import { buildDefaultFoodBankItems } from "./foodBankSeed";
import type { FoodItem } from "./foodBankTypes";

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
  if (stored?.length) return stored;
  const seeded = buildDefaultFoodBankItems();
  persistFoodBankItems(seeded);
  return seeded;
}

export function persistFoodBankItems(items: FoodItem[]): void {
  writeJson(FOOD_BANK_STORAGE_KEY, items);
  notifyFoodBankChanged();
}

export function loadFavoriteFoodIds(): string[] {
  return readJson<string[]>(FOOD_BANK_FAVORITES_KEY) ?? [];
}

export function persistFavoriteFoodIds(ids: string[]): void {
  writeJson(FOOD_BANK_FAVORITES_KEY, ids);
  notifyFoodBankChanged();
}

export function loadRecentFoodIds(): string[] {
  return readJson<string[]>(FOOD_BANK_RECENT_KEY) ?? [];
}

export function persistRecentFoodIds(ids: string[]): void {
  writeJson(FOOD_BANK_RECENT_KEY, ids);
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
