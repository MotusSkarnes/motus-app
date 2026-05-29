/**
 * Henter Matvaretabellen og genererer lookup for mikronæringsstoffer.
 * Kjør: node scripts/enrich-food-bank-micronutrients.mjs
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const MICRONUTRIENT_FIELDS = [
  { key: "vitaminA", matvaretabellId: "Vit A", unit: "ug" },
  { key: "vitaminD", matvaretabellId: "Vit D", unit: "ug" },
  { key: "vitaminE", matvaretabellId: "Vit E", unit: "mg" },
  { key: "vitaminC", matvaretabellId: "Vit C", unit: "mg" },
  { key: "vitaminB1", matvaretabellId: "Vit B1", unit: "mg" },
  { key: "vitaminB2", matvaretabellId: "Vit B2", unit: "mg" },
  { key: "niacin", matvaretabellId: "Niacin", unit: "mg" },
  { key: "vitaminB6", matvaretabellId: "Vit B6", unit: "mg" },
  { key: "folate", matvaretabellId: "Folat", unit: "ug" },
  { key: "vitaminB12", matvaretabellId: "Vit B12", unit: "ug" },
  { key: "calcium", matvaretabellId: "Ca", unit: "mg" },
  { key: "iron", matvaretabellId: "Fe", unit: "mg" },
  { key: "potassium", matvaretabellId: "K", unit: "mg" },
  { key: "magnesium", matvaretabellId: "Mg", unit: "mg" },
  { key: "phosphorus", matvaretabellId: "P", unit: "mg" },
  { key: "zinc", matvaretabellId: "Zn", unit: "mg" },
  { key: "selenium", matvaretabellId: "Se", unit: "ug" },
  { key: "iodine", matvaretabellId: "I", unit: "ug" },
  { key: "copper", matvaretabellId: "Cu", unit: "mg" },
];

const SEED_NAMES = [
  "Kyllingbryst",
  "Kyllinglår uten skinn",
  "Storfekjøtt mager",
  "Laks",
  "Torsk",
  "Tunfisk i vann",
  "Egg",
  "Eggewite",
  "Skyr naturell",
  "Cottage cheese",
  "Tofu fast",
  "Kalkunkjøtt",
  "Skinke",
  "Leverpostei",
  "Reker",
  "Svin indrefilet",
  "Proteinpulver whey",
  "Karbonadedeig mager",
  "Havregryn",
  "Basmatiris kokt",
  "Basmatiris tørr",
  "Fullkornspasta kokt",
  "Søtpotet",
  "Potet kokt",
  "Quinoa kokt",
  "Bulgur kokt",
  "Couscous kokt",
  "Rugbrød",
  "Grovt brød",
  "Banana",
  "Honning",
  "Olivenolje",
  "Avokado",
  "Mandler",
  "Valnøtter",
  "Peanøttsmør",
  "Smør",
  "Kokosolje",
  "Chiafrø",
  "Brokkoli",
  "Spinat",
  "Tomat",
  "Agurk",
  "Paprika",
  "Gulrot",
  "Squash",
  "Blomkål",
  "Asparges",
  "Rødbete",
  "Salat mix",
  "Løk",
  "Hvitløk",
  "Eple",
  "Appelsin",
  "Blåbær",
  "Jordbær",
  "Bringebær",
  "Mango",
  "Druer",
  "Ananas",
  "Kiwi",
  "Pære",
  "Helmelk",
  "Lettmelk",
  "Skummet melk",
  "Yoghurt naturell",
  "Gresk yoghurt",
  "Fløte 38%",
  "Mozzarella",
  "Norvegia lett",
  "Fetaost",
  "Rømme lett",
  "Bønner kidney kokt",
  "Kikerter kokt",
  "Linser kokt",
  "Hummus",
  "Granola",
  "Riskaker",
  "Müsli",
  "Makrell i tomat",
  "Kyllingwok grønnsaker",
  "Proteinbar",
  "Sjokolade mørk 70%",
  "Iskaffe protein",
];

/** Seed-navn → søkefraser i Matvaretabellen (første treff brukes). */
const SEARCH_HINTS = {
  Kyllingbryst: ["kylling, filet, kokt", "høne, bryst, filet, uten skinn, rå"],
  "Storfekjøtt mager": ["storfe, indrefilet, rå", "kjøttdeig, storfe, 4 % fett, rå"],
  Banana: ["banan, rå"],
  "Basmatiris kokt": ["ris, basmati, kokt", "ris, polert, parboiled, langkornet, kokt"],
  "Basmatiris tørr": ["ris, polert, basmatiris, tørr", "basmatiris, tørr"],
  "Fullkornspasta kokt": ["pasta, fullkorn, kokt"],
  "Potet kokt": ["potet, kokt", "potet, uten skall, kokt"],
  "Quinoa kokt": ["quinoa, kokt"],
  "Bulgur kokt": ["bulgur, kokt"],
  "Couscous kokt": ["couscous, tilberedt"],
  "Rugbrød": ["brød, rug"],
  "Grovt brød": ["brød, grovt"],
  "Skyr naturell": ["kvarg, 1 % fett, kesam", "yoghurt, naturell, 2 % fett, gresk/tyrkisk"],
  "Cottage cheese": ["cottage cheese"],
  "Tofu fast": ["tofu"],
  "Kalkunkjøtt": ["kalkun, bryst, filet, uten skinn, rå"],
  "Tunfisk i vann": ["tunfisk, i vann"],
  "Karbonadedeig mager": ["karbonadedeig, storfe, 4,5 % fett, rå", "kjøttdeig, storfe, 4 % fett, rå"],
  "Norvegia lett": ["ost, gulost, lett"],
  "Makrell i tomat": ["makrell, i tomat"],
  "Kyllingwok grønnsaker": ["wokblanding, klassisk"],
  "Sjokolade mørk 70%": ["sjokolade, mørk"],
  "Salat mix": ["bladsalat, norsk, rå", "feltsalat, rå"],
  "Eggewite": ["egg, hvite, rå", "eggehvite, rå"],
  "Fløte 38%": ["kremfløte, 37 % fett"],
  "Rømme lett": ["lettrømme, 10 % fett"],
  Druer: ["drue, rå"],
  Granola: ["granola, hjemmelaget"],
  Müsli: ["kornblanding, med frukt, fruktmüsli"],
};

/** Matvarer uten treff i Matvaretabellen — bruk nærmeste referanse per nøkkel. */
const MANUAL_SEED_MICRONUTRIENTS = {
  "Proteinpulver whey": "helmelk, uspesifisert",
  Proteinbar: "müslibar, energibar, hjemmelaget",
  "Iskaffe protein": "caffe latte, enkel, med helmelk",
};

function normalizeName(value) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9æøå]+/g, " ");
}

function normalizeUnit(unit) {
  return String(unit ?? "")
    .trim()
    .toLowerCase()
    .replace("µ", "u");
}

function convertAmount(amount, fromUnit, toUnit) {
  const from = normalizeUnit(fromUnit);
  const to = normalizeUnit(toUnit);
  if (from === to || !from || !to) return amount;
  if (to === "ug" && from === "mg") return amount * 1000;
  if (to === "ug" && from === "g") return amount * 1_000_000;
  if (to === "mg" && from === "ug") return amount / 1000;
  if (to === "mg" && from === "g") return amount * 1000;
  if (to === "g" && from === "mg") return amount / 1000;
  if (to === "g" && from === "ug") return amount / 1_000_000;
  return amount;
}

function parseConstituent(constituents, nutrientId, targetUnit) {
  const row = constituents?.find((entry) => entry.nutrientId === nutrientId);
  if (!row || row.quantity === undefined || !Number.isFinite(row.quantity)) return 0;
  return convertAmount(row.quantity, row.unit ?? targetUnit, targetUnit);
}

function micronutrientsFromConstituents(constituents) {
  const result = {};
  for (const field of MICRONUTRIENT_FIELDS) {
    result[field.key] = roundMicro(
      parseConstituent(constituents, field.matvaretabellId, field.unit),
      field.unit,
    );
  }
  return result;
}

function roundMicro(value, unit) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (unit === "ug") return Math.round(value * 10) / 10;
  if (unit === "mg" && value < 1) return Math.round(value * 100) / 100;
  if (unit === "mg") return Math.round(value * 10) / 10;
  return Math.round(value);
}

function scoreMatch(seedNorm, foodNorm) {
  if (seedNorm === foodNorm) return 1000;
  if (foodNorm.startsWith(seedNorm + ",") || foodNorm.startsWith(seedNorm + " ")) return 900;
  if (foodNorm.includes(seedNorm)) return 500 - foodNorm.length;
  const seedWords = seedNorm.split(" ").filter(Boolean);
  const foodWords = foodNorm.split(" ").filter(Boolean);
  let hits = 0;
  for (const word of seedWords) {
    if (foodWords.some((fw) => fw === word || fw.startsWith(word))) hits += 1;
  }
  return hits > 0 ? 100 + hits * 20 - foodNorm.length * 0.01 : 0;
}

function findBestFood(seedName, foods) {
  const hints = SEARCH_HINTS[seedName];
  if (hints?.length) {
    for (const hint of hints) {
      const hintNorm = normalizeName(hint);
      const hit = foods.find((food) => normalizeName(food.foodName ?? "") === hintNorm);
      if (hit) return hit;
      const partial = foods.filter((food) => normalizeName(food.foodName ?? "").includes(hintNorm));
      if (partial.length === 1) return partial[0];
      if (partial.length > 1) {
        partial.sort((a, b) => (a.foodName?.length ?? 0) - (b.foodName?.length ?? 0));
        return partial[0];
      }
    }
  }

  const seedNorm = normalizeName(seedName);
  let best = null;
  let bestScore = 0;
  for (const food of foods) {
    const foodNorm = normalizeName(food.foodName ?? "");
    const score = scoreMatch(seedNorm, foodNorm);
    if (score > bestScore) {
      bestScore = score;
      best = food;
    }
  }
  return bestScore >= 120 ? best : null;
}

async function main() {
  const response = await fetch("https://www.matvaretabellen.no/api/nb/foods.json");
  if (!response.ok) throw new Error(`Matvaretabellen ${response.status}`);
  const payload = await response.json();
  const foods = Array.isArray(payload.foods) ? payload.foods : [];
  console.log(`Fetched ${foods.length} foods from Matvaretabellen`);

  const lookup = {};
  const seedMatches = {};
  const unmatched = [];

  for (const food of foods) {
    const name = String(food.foodName ?? "").trim();
    if (!name) continue;
    const key = normalizeName(name);
    const micros = micronutrientsFromConstituents(food.constituents);
    const hasData = Object.values(micros).some((v) => v > 0);
    if (!hasData) continue;
    lookup[key] = { name, micros };
  }

  for (const seedName of SEED_NAMES) {
    const manualHint = MANUAL_SEED_MICRONUTRIENTS[seedName];
    const food = manualHint
      ? foods.find((entry) => normalizeName(entry.foodName ?? "") === normalizeName(manualHint)) ??
        findBestFood(manualHint, foods)
      : findBestFood(seedName, foods);
    if (!food) {
      unmatched.push(seedName);
      continue;
    }
    const micros = micronutrientsFromConstituents(food.constituents);
    seedMatches[seedName] = {
      matvaretabellenName: food.foodName,
      micros,
    };
    lookup[normalizeName(seedName)] = { name: seedName, micros };
  }

  const outPath = join(root, "src/app/foodBankMicronutrientsData.json");
  writeFileSync(
    outPath,
    JSON.stringify({ generatedAt: new Date().toISOString(), lookup, seedMatches }, null, 0),
    "utf8",
  );

  console.log(`Wrote ${outPath}`);
  console.log(`Lookup entries: ${Object.keys(lookup).length}`);
  console.log(`Seed matched: ${Object.keys(seedMatches).length}/${SEED_NAMES.length}`);
  if (unmatched.length) {
    console.warn("Unmatched seeds:", unmatched.join(", "));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
