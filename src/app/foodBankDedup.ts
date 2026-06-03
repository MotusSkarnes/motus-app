import { normalizeFoodBankNameKey } from "./foodBankNameKey";
import type { FoodItem, FoodNutrition } from "./foodBankTypes";

export type FoodBankDedupResult = {
  items: FoodItem[];
  /** Fjernet id → beholdt id */
  idRemap: Record<string, string>;
  removedCount: number;
  /** Grupper med samme næring, ulike navn */
  nutritionDuplicateGroups: Array<{ keepId: string; keepName: string; removed: Array<{ id: string; name: string }> }>;
};

/** Nøkkel for identisk næring per 100 g (avrundet). */
export function foodNutritionSignature(n: FoodNutrition): string {
  const r = (value: number, decimals = 1): string => {
    if (!Number.isFinite(value)) return "0";
    return decimals === 0 ? String(Math.round(value)) : value.toFixed(decimals);
  };
  return [
    r(n.kcal, 0),
    r(n.protein),
    r(n.carbs),
    r(n.fat),
    r(n.fiber),
    r(n.sugar),
    r(n.saturatedFat),
    r(n.sodium, 0),
  ].join("|");
}

function hasMeaningfulNutrition(n: FoodNutrition): boolean {
  const kcal = Number(n.kcal) || 0;
  if (kcal >= 15) return true;
  const macroSum = (Number(n.protein) || 0) + (Number(n.carbs) || 0) + (Number(n.fat) || 0);
  return macroSum >= 5;
}

function canonicalScore(item: FoodItem): number {
  let score = 0;
  if (item.isEdited) score += 10_000;
  if (item.isCustom) score += 5_000;
  if (item.id.startsWith("food-seed-")) score += 1_000;
  const name = item.name.trim();
  if (!name.includes(",")) score += 50;
  if (name.length <= 24) score += 20;
  score -= name.length;
  return score;
}

function pickCanonical(group: FoodItem[]): FoodItem {
  return [...group].sort((a, b) => canonicalScore(b) - canonicalScore(a))[0];
}

/**
 * Slår sammen matvarer med identisk navn (normalisert) eller identisk næring per 100 g.
 * Egne / redigerte varer beholdes alltid som kanonisk innen gruppen.
 */
export function dedupeFoodBankItems(items: FoodItem[]): FoodBankDedupResult {
  if (items.length <= 1) {
    return { items, idRemap: {}, removedCount: 0, nutritionDuplicateGroups: [] };
  }

  const idRemap: Record<string, string> = {};
  const nutritionDuplicateGroups: FoodBankDedupResult["nutritionDuplicateGroups"] = [];

  // 1) Identisk navn + kategori
  const byName = new Map<string, FoodItem[]>();
  for (const item of items) {
    const key = `${item.category}\u0001${normalizeFoodBankNameKey(item.name)}`;
    const list = byName.get(key) ?? [];
    list.push(item);
    byName.set(key, list);
  }

  const afterName = new Map<string, FoodItem>();
  for (const group of byName.values()) {
    const canonical = pickCanonical(group);
    afterName.set(canonical.id, canonical);
    for (const item of group) {
      if (item.id !== canonical.id) idRemap[item.id] = canonical.id;
    }
  }

  // 2) Identisk næring (men ulikt navn)
  const byNutrition = new Map<string, FoodItem[]>();
  for (const item of afterName.values()) {
    if (!hasMeaningfulNutrition(item.nutritionPer100g)) {
      byNutrition.set(`solo:${item.id}`, [item]);
      continue;
    }
    const key = `${item.category}\u0001${foodNutritionSignature(item.nutritionPer100g)}`;
    const list = byNutrition.get(key) ?? [];
    list.push(item);
    byNutrition.set(key, list);
  }

  const finalById = new Map<string, FoodItem>();
  for (const group of byNutrition.values()) {
    if (group.length <= 1) {
      finalById.set(group[0].id, group[0]);
      continue;
    }
    const canonical = pickCanonical(group);
    finalById.set(canonical.id, canonical);
    const removed: Array<{ id: string; name: string }> = [];
    for (const item of group) {
      if (item.id === canonical.id) continue;
      idRemap[item.id] = canonical.id;
      removed.push({ id: item.id, name: item.name });
    }
    if (removed.length > 0) {
      nutritionDuplicateGroups.push({
        keepId: canonical.id,
        keepName: canonical.name,
        removed,
      });
    }
  }

  const deduped = Array.from(finalById.values()).sort((a, b) => a.name.localeCompare(b.name, "nb"));
  return {
    items: deduped,
    idRemap,
    removedCount: items.length - deduped.length,
    nutritionDuplicateGroups,
  };
}

/** Oppdater foodId i lister (favoritter, nylige, måltidsplaner). */
export function remapFoodIdList(ids: string[], idRemap: Record<string, string>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    const mapped = idRemap[id] ?? id;
    if (!mapped.trim() || seen.has(mapped)) continue;
    seen.add(mapped);
    out.push(mapped);
  }
  return out;
}
