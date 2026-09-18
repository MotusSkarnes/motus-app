import { withoutCoveredSeedPlaceholders } from "./foodBankDedup";
import { normalizeFoodBankNameKey } from "./foodBankNameKey";
import type { FoodItem } from "./foodBankTypes";

function primaryName(name: string): string {
  return name.split(",")[0]?.trim() || name.trim();
}

function levenshteinAtMost(left: string, right: string, max: number): number {
  if (left === right) return 0;
  if (Math.abs(left.length - right.length) > max) return max + 1;
  let a = left;
  let b = right;
  if (a.length > b.length) {
    const swap = a;
    a = b;
    b = swap;
  }
  let previous = Array.from({ length: a.length + 1 }, (_, index) => index);
  for (let column = 1; column <= b.length; column += 1) {
    const current = [column];
    let rowMin = column;
    for (let row = 1; row <= a.length; row += 1) {
      const cost = a[row - 1] === b[column - 1] ? 0 : 1;
      const value = Math.min(previous[row] + 1, current[row - 1] + 1, previous[row - 1] + cost);
      current.push(value);
      if (value < rowMin) rowMin = value;
    }
    if (rowMin > max) return max + 1;
    previous = current;
  }
  return previous[a.length] ?? max + 1;
}

function maxEditDistance(queryKey: string): number {
  if (queryKey.length >= 7) return 2;
  if (queryKey.length >= 4) return 1;
  return 0;
}

/** Lower is better. `null` means no match. */
export function foodSearchScore(query: string, item: FoodItem): number | null {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return 0;
  const queryKey = normalizeFoodBankNameKey(trimmed);
  if (!queryKey) return null;

  const name = item.name.trim();
  const primary = primaryName(name);
  const nameKey = normalizeFoodBankNameKey(name);
  const primaryKey = normalizeFoodBankNameKey(primary);
  const haystack = `${name} ${item.origin}`.toLowerCase();

  if (primaryKey === queryKey || nameKey === queryKey) return 0;
  if (primary.toLowerCase() === trimmed) return 1;
  if (primaryKey.startsWith(queryKey)) return 10 + primaryKey.length;
  if (nameKey.startsWith(queryKey)) return 20 + nameKey.length;
  if (primaryKey.includes(queryKey)) return 40 + primaryKey.length;
  if (nameKey.includes(queryKey)) return 50 + nameKey.length;
  if (haystack.includes(trimmed)) return 80;

  const maxDist = maxEditDistance(queryKey);
  if (maxDist > 0) {
    const primaryDist = levenshteinAtMost(queryKey, primaryKey, maxDist);
    if (primaryDist <= maxDist) return 60 + primaryDist * 10 + primaryKey.length;
    if (Math.abs(nameKey.length - queryKey.length) <= maxDist) {
      const nameDist = levenshteinAtMost(queryKey, nameKey, maxDist);
      if (nameDist <= maxDist) return 70 + nameDist * 10;
    }
  }
  return null;
}

export function foodItemMatchesSearch(item: FoodItem, query: string): boolean {
  return foodSearchScore(query, item) != null;
}

export function searchFoodBankItems(items: FoodItem[], query: string, limit = 20): FoodItem[] {
  const trimmed = query.trim();
  if (!trimmed) return [];
  return withoutCoveredSeedPlaceholders(items)
    .map((item) => ({ item, score: foodSearchScore(trimmed, item) }))
    .filter((row): row is { item: FoodItem; score: number } => row.score != null)
    .sort((left, right) => left.score - right.score || left.item.name.localeCompare(right.item.name, "no"))
    .slice(0, limit)
    .map((row) => row.item);
}
