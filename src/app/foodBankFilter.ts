import type { FoodBankFilterChip, FoodItem, FoodMacroFilter, FoodSource } from "./foodBankTypes";

export type FoodBankListFilters = {
  chip: FoodBankFilterChip;
  search: string;
  favoriteIds: Set<string>;
  recentIds: string[];
  sources: FoodSource[];
  favoritesOnly: boolean;
  mineOnly: boolean;
  macro: FoodMacroFilter;
  trainerName: string;
};

function parseBound(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function inRange(value: number, min: string, max: string): boolean {
  const minValue = parseBound(min);
  const maxValue = parseBound(max);
  if (minValue !== null && value < minValue) return false;
  if (maxValue !== null && value > maxValue) return false;
  return true;
}

export function filterFoodBankItems(items: FoodItem[], filters: FoodBankListFilters): FoodItem[] {
  const query = filters.search.trim().toLowerCase();
  const recentSet = new Set(filters.recentIds);

  return items.filter((item) => {
    if (query) {
      const haystack = `${item.name} ${item.origin} ${item.category}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }

    if (filters.favoritesOnly && !filters.favoriteIds.has(item.id)) return false;
    if (filters.mineOnly && item.createdBy.trim() !== filters.trainerName.trim()) return false;

    if (filters.sources.length > 0 && !filters.sources.includes(item.source)) return false;

    const nutrition = item.nutritionPer100g;
    if (!inRange(nutrition.kcal, filters.macro.kcalMin, filters.macro.kcalMax)) return false;
    if (!inRange(nutrition.protein, filters.macro.proteinMin, filters.macro.proteinMax)) return false;
    if (!inRange(nutrition.carbs, filters.macro.carbsMin, filters.macro.carbsMax)) return false;
    if (!inRange(nutrition.fat, filters.macro.fatMin, filters.macro.fatMax)) return false;

    switch (filters.chip) {
      case "all":
        return true;
      case "favorites":
        return filters.favoriteIds.has(item.id);
      case "mine":
        return item.isCustom === true || item.createdBy.trim() === filters.trainerName.trim();
      case "recent":
        return recentSet.has(item.id);
      default:
        return item.category === filters.chip;
    }
  });
}

export function sortFoodBankItems(items: FoodItem[], chip: FoodBankFilterChip, recentIds: string[]): FoodItem[] {
  if (chip === "recent") {
    const order = new Map(recentIds.map((id, index) => [id, index]));
    return [...items].sort((a, b) => (order.get(a.id) ?? 999) - (order.get(b.id) ?? 999));
  }
  return [...items].sort((a, b) => a.name.localeCompare(b.name, "no"));
}
