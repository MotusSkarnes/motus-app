import { canonicalFoodBankNameKey, foodNamePrimaryKey, normalizeFoodBankNameKey } from "./foodBankNameKey";
import { isGenericDefaultPortion } from "./foodPortionDefaults";
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
  if (isOfficialTableFood(item)) score += 3_000;
  if (!isGenericDefaultPortion(item)) score += 2_000;
  if (item.id.startsWith("food-seed-")) score -= 2_000;
  const name = item.name.trim();
  if (!name.includes(",")) score += 50;
  if (name.length <= 24) score += 20;
  score -= name.length;
  return score;
}

function withMergedAliasIds(keep: FoodItem, dropped: FoodItem[]): FoodItem {
  const aliasIds = [
    ...new Set([
      ...(keep.aliasIds ?? []),
      ...dropped.flatMap((item) => [item.id, ...(item.aliasIds ?? [])]),
    ]),
  ].filter((id) => id !== keep.id);
  return aliasIds.length ? { ...keep, aliasIds } : { ...keep, aliasIds: undefined };
}

function pickCanonical(group: FoodItem[]): FoodItem {
  return [...group].sort((a, b) => canonicalScore(b) - canonicalScore(a))[0];
}

function isImportedTableId(id: string): boolean {
  return id.startsWith("food-matvaretabell-") || id.startsWith("food-usda-");
}

function isCollapsiblePlaceholder(item: FoodItem): boolean {
  if (item.isCustom === true || item.isEdited === true) return false;
  if (item.source === "egen") return false;
  if (item.name.includes(",")) return false;
  if (isImportedTableId(item.id)) return false;
  return true;
}

function isOfficialTableFood(item: FoodItem): boolean {
  if (item.isCustom === true) return false;
  if (item.source === "egen") return false;
  if (item.id.startsWith("food-seed-")) return false;
  return isImportedTableId(item.id) || item.name.includes(",");
}

const PROCESSED_NAME_PATTERN = /juice|kake|suppe|smoothie|muffins|pai|grøt|salat|blanding|hermet|sylt/;

export function tableNameCoversSeedName(tableName: string, seedName: string): boolean {
  const seedKey = canonicalFoodBankNameKey(seedName);
  if (!seedKey) return false;
  if (canonicalFoodBankNameKey(tableName) === seedKey) return true;
  return foodNamePrimaryKey(tableName) === seedKey;
}

function tableMatchScore(seedName: string, table: FoodItem): number {
  const seed = seedName.toLowerCase();
  const name = table.name.toLowerCase();
  let score = 40;
  if (/(^|,\s*)rå(\s|,|$)/i.test(table.name)) score += 80;
  if (name.includes("norsk")) score += 20;
  if (name.includes("kokt") && !seed.includes("kokt")) score -= 45;
  if (name.includes("fryst") && !seed.includes("fryst")) score -= 35;
  if (PROCESSED_NAME_PATTERN.test(name) && !PROCESSED_NAME_PATTERN.test(seed)) score -= 150;
  score -= table.name.length * 0.05;
  return score;
}

function addNameKeys(keys: Set<string>, name: string): void {
  const full = canonicalFoodBankNameKey(name);
  const primary = foodNamePrimaryKey(name);
  if (full) keys.add(full);
  if (primary) keys.add(primary);
}

/** Navnenøkler som allerede finnes, inkludert primærnavn fra tabellvarer (Gulrot, rå → gulrot). */
export function foodBankCoveredNameKeys(items: FoodItem[]): Set<string> {
  const keys = new Set<string>();
  for (const item of items) {
    addNameKeys(keys, item.name);
  }
  return keys;
}

function officialCoveredNameKeys(items: FoodItem[]): Set<string> {
  const keys = new Set<string>();
  for (const item of items) {
    if (!isOfficialTableFood(item)) continue;
    addNameKeys(keys, item.name);
  }
  return keys;
}

export function existingFoodCoversSeedName(items: FoodItem[], seedName: string): boolean {
  const seedKey = canonicalFoodBankNameKey(seedName);
  if (!seedKey) return false;
  return officialCoveredNameKeys(items).has(seedKey);
}

export function withoutCoveredSeedPlaceholders(items: FoodItem[]): FoodItem[] {
  const covered = officialCoveredNameKeys(items);
  if (!covered.size) return items;
  return items.filter((item) => {
    if (!isCollapsiblePlaceholder(item)) return true;
    const key = canonicalFoodBankNameKey(item.name);
    return !key || !covered.has(key);
  });
}

function collapseSeedPlaceholders(items: FoodItem[], idRemap: Record<string, string>): FoodItem[] {
  const official = items.filter(isOfficialTableFood);
  if (!official.length) return items;

  const byPrimary = new Map<string, FoodItem[]>();
  for (const item of official) {
    const key = foodNamePrimaryKey(item.name);
    if (!key) continue;
    const list = byPrimary.get(key) ?? [];
    list.push(item);
    byPrimary.set(key, list);
  }

  const keep = new Map(items.map((item) => [item.id, item]));
  for (const placeholder of items) {
    if (!isCollapsiblePlaceholder(placeholder)) continue;
    const key = canonicalFoodBankNameKey(placeholder.name);
    const covers = (byPrimary.get(key) ?? []).filter((item) => item.id !== placeholder.id);
    if (!covers.length) continue;
    const best = [...covers].sort((left, right) => tableMatchScore(placeholder.name, right) - tableMatchScore(placeholder.name, left))[0];
    if (!best || tableMatchScore(placeholder.name, best) < 0) continue;
    keep.delete(placeholder.id);
    const kept = keep.get(best.id) ?? best;
    keep.set(best.id, {
      ...kept,
      aliasIds: [...new Set([...(kept.aliasIds ?? []), placeholder.id, ...(placeholder.aliasIds ?? [])])],
    });
    idRemap[placeholder.id] = best.id;
  }
  return Array.from(keep.values());
}

/**
 * Slår sammen matvarer med identisk navn (normalisert) eller identisk næring per 100 g.
 * Egne / redigerte varer beholdes alltid som kanonisk innen gruppen.
 * Korte Motus-startvarer slås inn i Matvaretabellen når navnet treffer, f.eks. Gulrot → Gulrot, norsk, rå.
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
    const dropped = group.filter((item) => item.id !== canonical.id);
    for (const item of dropped) idRemap[item.id] = canonical.id;
    afterName.set(canonical.id, withMergedAliasIds(canonical, dropped));
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
    const dropped = group.filter((item) => item.id !== canonical.id);
    finalById.set(canonical.id, withMergedAliasIds(canonical, dropped));
    const removed: Array<{ id: string; name: string }> = [];
    for (const item of dropped) {
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

  const collapsed = collapseSeedPlaceholders(Array.from(finalById.values()), idRemap);
  const deduped = collapsed.sort((a, b) => a.name.localeCompare(b.name, "nb"));
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

export function findFoodItemById(items: FoodItem[], foodId: string | null | undefined): FoodItem | undefined {
  const id = foodId?.trim();
  if (!id) return undefined;
  return items.find((item) => item.id === id || item.aliasIds?.includes(id));
}

export function foodItemsById(items: FoodItem[]): Map<string, FoodItem> {
  const map = new Map<string, FoodItem>();
  for (const item of items) {
    map.set(item.id, item);
    for (const aliasId of item.aliasIds ?? []) {
      if (aliasId.trim() && !map.has(aliasId)) map.set(aliasId, item);
    }
  }
  return map;
}
