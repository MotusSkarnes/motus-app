/**
 * Finner duplikate matvarer (identisk næring per 100 g) i Matvaretabellen + seed.
 * Kjør: node scripts/dedupe-food-bank.mjs
 */

const MATVARETABELLEN_URL = "https://www.matvaretabellen.no/api/nb/foods.json";

const NUTRIENT_IDS = {
  protein: "Protein",
  fat: "Fett",
  carbs: "Karbo",
  fiber: "Fiber",
  sugar: "Sukker",
  saturatedFat: "Mettet",
  sodium: "Na",
};

const FOOD_GROUP_CATEGORY = {
  "1": "meieriprodukter",
  "2": "proteinkilder",
  "3": "proteinkilder",
  "4": "proteinkilder",
  "5": "karbohydrater",
  "6": "gronnsaker",
  "7": "karbohydrater",
  "8": "fettkilder",
  "9": "karbohydrater",
  "10": "karbohydrater",
  "12": "karbohydrater",
  "13": "frukt-baer",
  "14": "fettkilder",
  "15": "karbohydrater",
};

function normalizeNameKey(name) {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ");
}

function stableImportId(name, source = "matvaretabell") {
  const slug = name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return `food-${source}-${slug || "unknown"}`;
}

function constituentAmount(food, nutrientId) {
  const row = food.constituents?.find((entry) => entry.nutrientId === nutrientId);
  if (!row || row.quantity === undefined) return 0;
  const amount = row.quantity;
  if (nutrientId === NUTRIENT_IDS.sodium) {
    if (row.unit === "mg") return amount;
    if (row.unit === "g") return amount * 1000;
  }
  return amount;
}

function mapFoodGroupToCategory(foodGroupId) {
  if (!foodGroupId) return "proteinkilder";
  const top = String(foodGroupId).split(".")[0] ?? foodGroupId;
  return FOOD_GROUP_CATEGORY[top] ?? "proteinkilder";
}

function mapMatvaretabellenFood(food) {
  const name = String(food.foodName ?? "").trim();
  if (!name) return null;
  const category = mapFoodGroupToCategory(food.foodGroupId);
  const n = {
    kcal: food.calories?.quantity ?? 0,
    protein: constituentAmount(food, NUTRIENT_IDS.protein),
    carbs: constituentAmount(food, NUTRIENT_IDS.carbs),
    fat: constituentAmount(food, NUTRIENT_IDS.fat),
    fiber: constituentAmount(food, NUTRIENT_IDS.fiber),
    sugar: constituentAmount(food, NUTRIENT_IDS.sugar),
    saturatedFat: constituentAmount(food, NUTRIENT_IDS.saturatedFat),
    sodium: constituentAmount(food, NUTRIENT_IDS.sodium),
  };
  return {
    id: stableImportId(name),
    name,
    category,
    source: "matvaretabell",
    nutritionPer100g: n,
  };
}

function hasMeaningfulNutrition(n) {
  const kcal = Number(n.kcal) || 0;
  if (kcal >= 15) return true;
  return (Number(n.protein) || 0) + (Number(n.carbs) || 0) + (Number(n.fat) || 0) >= 5;
}

function nutritionSignature(n) {
  const r = (v, dec = 1) => {
    const num = Number(v);
    if (!Number.isFinite(num)) return "0";
    return dec === 0 ? String(Math.round(num)) : num.toFixed(dec);
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

function canonicalScore(item) {
  let score = 0;
  if (item.isEdited) score += 10_000;
  if (item.isCustom) score += 5_000;
  if (String(item.id).startsWith("food-seed-")) score += 1_000;
  const name = item.name.trim();
  if (!name.includes(",")) score += 50;
  score -= name.length;
  return score;
}

function pickCanonical(group) {
  return [...group].sort((a, b) => canonicalScore(b) - canonicalScore(a))[0];
}

function dedupeItems(items) {
  const byName = new Map();
  for (const item of items) {
    const key = `${item.category}\u0001${normalizeNameKey(item.name)}`;
    const list = byName.get(key) ?? [];
    list.push(item);
    byName.set(key, list);
  }

  const kept = new Map();
  const idRemap = new Map();

  for (const group of byName.values()) {
    const canonical = pickCanonical(group);
    kept.set(canonical.id, canonical);
    for (const item of group) {
      if (item.id !== canonical.id) idRemap.set(item.id, canonical.id);
    }
  }

  const remaining = Array.from(kept.values());
  const byNutrition = new Map();
  for (const item of remaining) {
    if (!hasMeaningfulNutrition(item.nutritionPer100g)) {
      byNutrition.set(`solo:${item.id}`, [item]);
      continue;
    }
    const sig = `${item.category}\u0001${nutritionSignature(item.nutritionPer100g)}`;
    const list = byNutrition.get(sig) ?? [];
    list.push(item);
    byNutrition.set(sig, list);
  }

  const finalKept = new Map();
  const nutritionDupes = [];

  for (const group of byNutrition.values()) {
    if (group.length <= 1) {
      finalKept.set(group[0].id, group[0]);
      continue;
    }
    const canonical = pickCanonical(group);
    finalKept.set(canonical.id, canonical);
    for (const item of group) {
      if (item.id !== canonical.id) {
        idRemap.set(item.id, canonical.id);
        nutritionDupes.push({ keep: canonical.name, remove: item.name, id: item.id });
      }
    }
  }

  return {
    items: Array.from(finalKept.values()),
    idRemap,
    nutritionDupes,
    removedCount: items.length - finalKept.size,
  };
}

async function main() {
  const response = await fetch(MATVARETABELLEN_URL);
  const data = await response.json();
  const imported = (data.foods ?? []).map(mapMatvaretabellenFood).filter(Boolean);

  const seedNames = [
    "Rugbrød",
    "Grovt brød",
  ];
  for (const name of seedNames) {
    const hit = imported.find((i) => normalizeNameKey(i.name) === normalizeNameKey(name));
    const rug = imported.filter((i) => /rugbrød|rugbr/i.test(i.name));
    const grov = imported.filter((i) => /grov.*brød|brød.*grov/i.test(i.name) && !/baguette|burger/i.test(i.name));
    console.log(`\nSeed «${name}» i tabellen:`, hit ? hit.name : "(ikke eksakt)");
  }

  const { items, removedCount, nutritionDupes, idRemap } = dedupeItems(imported);
  console.log(`\nMatvaretabellen: ${imported.length} rader → ${items.length} etter dedup (${removedCount} fjernet)`);
  console.log(`ID-remap: ${idRemap.size}`);

  const brodDupes = nutritionDupes.filter(
    (d) => /brød|rug|grov/i.test(d.keep) || /brød|rug|grov/i.test(d.remove),
  );
  console.log(`\nBrød-relaterte næringsduplikater (${brodDupes.length}):`);
  for (const row of brodDupes.slice(0, 25)) {
    console.log(`  behold: ${row.keep}`);
    console.log(`  fjern:  ${row.remove}`);
  }

  const topGroups = nutritionDupes.slice(0, 30);
  console.log(`\nFørste 30 næringsduplikat-grupper (ulike navn, samme næring):`);
  for (const row of topGroups) {
    console.log(`  ${row.remove} → ${row.keep}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
