/**
 * Henter Matvaretabellen og genererer lookup for husholdningsmål (ss, ts, dl, stk, …).
 * Kjør: node scripts/enrich-food-bank-unit-grams.mjs
 *
 * Mappingen må holdes i sync med unitGramsFromMatvaretabellenPortions i src/app/foodUnitGrams.ts.
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const OUT = join(root, "src", "app", "foodBankUnitGramsData.json");
const FOODS_URL = "https://www.matvaretabellen.no/api/nb/foods.json";

const PORTION_TO_UNIT = {
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

function unitGramsFromPortions(portions) {
  if (!Array.isArray(portions) || portions.length === 0) return null;
  const exact = {};

  for (const portion of portions) {
    const grams = Number(portion?.quantity);
    if (!Number.isFinite(grams) || grams <= 0) continue;
    const unitCode = String(portion?.unit ?? "g").trim().toLowerCase();
    if (unitCode && unitCode !== "g") continue;
    const id = String(portion?.id ?? "").trim().toLowerCase();
    const name = String(portion?.portionName ?? "").trim().toLowerCase();
    const mapped = PORTION_TO_UNIT[id] ?? PORTION_TO_UNIT[name];
    if (!mapped) continue;
    exact[mapped] = grams;
  }

  return Object.keys(exact).length ? exact : null;
}

function normalizeKey(name) {
  return String(name ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9æøå]+/g, "")
    .trim();
}

function scoreEntry(fullKey, units) {
  return Object.keys(units).length * 10 - fullKey.length;
}

const response = await fetch(FOODS_URL);
if (!response.ok) {
  throw new Error(`Matvaretabellen svarte ${response.status}`);
}
const payload = await response.json();
const foods = Array.isArray(payload?.foods) ? payload.foods : [];
const lookup = {};
const shortBest = new Map();
let mappedFoods = 0;

for (const food of foods) {
  const name = String(food?.foodName ?? "").trim();
  const units = unitGramsFromPortions(food?.portions);
  if (!name || !units) continue;
  mappedFoods += 1;
  const fullKey = normalizeKey(name);
  if (fullKey) lookup[fullKey] = units;

  const shortName = name.split(",")[0]?.trim() ?? "";
  const shortKey = normalizeKey(shortName);
  if (!shortKey || shortKey.length < 3) continue;
  const current = shortBest.get(shortKey);
  const nextScore = scoreEntry(fullKey, units);
  if (!current || nextScore > current.score) {
    shortBest.set(shortKey, { units, score: nextScore });
  }
}

for (const [shortKey, entry] of shortBest) {
  if (!lookup[shortKey]) lookup[shortKey] = entry.units;
}

writeFileSync(
  OUT,
  `${JSON.stringify(
    {
      source: FOODS_URL,
      generatedAt: new Date().toISOString(),
      foodCount: mappedFoods,
      lookup,
    },
    null,
    2,
  )}\n`,
);
console.log(`Wrote ${mappedFoods} foods / ${Object.keys(lookup).length} keys to ${OUT}`);
