import {
  micronutrientCsvHeaderColumns,
  micronutrientsFromCsvRow,
  micronutrientsFromMatvaretabellen,
} from "./foodBankMicronutrients";
import { foodCategoryMeta, type FoodCategoryId, type FoodItem, type FoodSource } from "./foodBankTypes";
import { uid } from "./storage";

export const MATVARETABELLEN_FOODS_URL = "https://www.matvaretabellen.no/api/nb/foods.json";

export const FOOD_IMPORT_CSV_TEMPLATE = `navn;kategori;kilde;opprinnelse;porsjon;porsjon_gram;kcal;protein;karbohydrater;fett;kostfiber;sukker;mettet_fett;natrium_mg;${micronutrientCsvHeaderColumns()};emoji
Kyllingbryst;proteinkilder;egen;Kjøtt & fjærkre;100 g;100;165;31;0;3.6;0;0;1;74;;;;;;;;;;;;;;;;;🍗`;

export type FoodImportMergeMode = "skip" | "update";

export type FoodImportParseResult = {
  items: FoodItem[];
  errors: string[];
  format: "motus-csv" | "motus-json" | "matvaretabellen" | "unknown";
};

export type FoodImportMergeResult = {
  items: FoodItem[];
  added: number;
  updated: number;
  skipped: number;
};

type MatvaretabellenFood = {
  foodName?: string;
  foodGroupId?: string;
  calories?: { quantity?: number };
  portions?: Array<{ portionName?: string; quantity?: number; unit?: string }>;
  constituents?: Array<{ nutrientId?: string; quantity?: number; unit?: string }>;
};

const NUTRIENT_IDS = {
  protein: "Protein",
  fat: "Fett",
  carbs: "Karbo",
  fiber: "Fiber",
  sugar: "Sukker",
  saturatedFat: "Mettet",
  sodium: "Na",
} as const;

const FOOD_GROUP_CATEGORY: Record<string, FoodCategoryId> = {
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

const VALID_CATEGORIES = new Set<FoodCategoryId>([
  "proteinkilder",
  "karbohydrater",
  "fettkilder",
  "gronnsaker",
  "frukt-baer",
  "meieriprodukter",
]);

const VALID_SOURCES = new Set<FoodSource>(["matvaretabell", "usda", "egen"]);

export function foodMatchKey(item: Pick<FoodItem, "name" | "source">): string {
  return `${item.source}::${item.name.trim().toLowerCase()}`;
}

function parseNumber(value: string | number | undefined | null): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number(String(value ?? "").trim().replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseCategory(value: string): FoodCategoryId {
  const normalized = value.trim().toLowerCase() as FoodCategoryId;
  return VALID_CATEGORIES.has(normalized) ? normalized : "proteinkilder";
}

function parseSource(value: string): FoodSource {
  const normalized = value.trim().toLowerCase();
  if (normalized === "matvaretabell" || normalized === "matvaretabellen") return "matvaretabell";
  if (normalized === "usda") return "usda";
  return "egen";
}

function constituentAmount(food: MatvaretabellenFood, nutrientId: string): number {
  const row = food.constituents?.find((entry) => entry.nutrientId === nutrientId);
  if (!row || row.quantity === undefined) return 0;
  const amount = row.quantity;
  if (nutrientId === NUTRIENT_IDS.sodium) {
    if (row.unit === "mg") return amount;
    if (row.unit === "g") return amount * 1000;
  }
  return amount;
}

function mapFoodGroupToCategory(foodGroupId?: string): FoodCategoryId {
  if (!foodGroupId) return "proteinkilder";
  const top = foodGroupId.split(".")[0] ?? foodGroupId;
  return FOOD_GROUP_CATEGORY[top] ?? "proteinkilder";
}

function stableImportId(name: string, source: FoodSource): string {
  const slug = name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return `food-${source}-${slug || uid("food")}`;
}

export function mapMatvaretabellenFood(food: MatvaretabellenFood, trainerName: string): FoodItem | null {
  const name = String(food.foodName ?? "").trim();
  if (!name) return null;

  const category = mapFoodGroupToCategory(food.foodGroupId);
  const meta = foodCategoryMeta(category);
  const portion = food.portions?.[0];
  const portionGrams = portion?.quantity ?? 100;
  const portionUnit = portion?.unit ?? "g";
  const portionName = portion?.portionName
    ? `${portion.quantity ?? 100} ${portionUnit} (${portion.portionName})`
    : "100 g";

  return {
    id: stableImportId(name, "matvaretabell"),
    name,
    portionLabel: portionName,
    portionGrams,
    category,
    origin: meta.originHint,
    source: "matvaretabell",
    createdBy: trainerName,
    createdAt: new Date().toISOString(),
    imageEmoji: meta.emoji,
    isCustom: false,
    isEdited: false,
    nutritionPer100g: {
      kcal: food.calories?.quantity ?? 0,
      protein: constituentAmount(food, NUTRIENT_IDS.protein),
      carbs: constituentAmount(food, NUTRIENT_IDS.carbs),
      fat: constituentAmount(food, NUTRIENT_IDS.fat),
      fiber: constituentAmount(food, NUTRIENT_IDS.fiber),
      sugar: constituentAmount(food, NUTRIENT_IDS.sugar),
      saturatedFat: constituentAmount(food, NUTRIENT_IDS.saturatedFat),
      sodium: constituentAmount(food, NUTRIENT_IDS.sodium),
      micronutrients: micronutrientsFromMatvaretabellen(food.constituents),
    },
  };
}

function parseCsvLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (!inQuotes && char === delimiter) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

function detectDelimiter(headerLine: string): string {
  const semicolons = (headerLine.match(/;/g) ?? []).length;
  const commas = (headerLine.match(/,/g) ?? []).length;
  return semicolons >= commas ? ";" : ",";
}

function rowToFoodItem(row: Record<string, string>, trainerName: string, lineNo: number, errors: string[]): FoodItem | null {
  const name = (row.navn ?? row.name ?? "").trim();
  if (!name) {
    errors.push(`Rad ${lineNo}: mangler navn.`);
    return null;
  }
  const category = parseCategory(row.kategori ?? row.category ?? "proteinkilder");
  const source = parseSource(row.kilde ?? row.source ?? "egen");
  const meta = foodCategoryMeta(category);
  return {
    id: stableImportId(name, source),
    name,
    portionLabel: (row.porsjon ?? row.portion ?? "100 g").trim() || "100 g",
    portionGrams: parseNumber(row.porsjon_gram ?? row.portion_grams ?? "100") || 100,
    category,
    origin: (row.opprinnelse ?? row.origin ?? meta.originHint).trim() || meta.originHint,
    source,
    createdBy: trainerName,
    createdAt: new Date().toISOString(),
    imageEmoji: (row.emoji ?? row.imageemoji ?? meta.emoji).trim() || meta.emoji,
    isCustom: source === "egen",
    isEdited: false,
    nutritionPer100g: {
      kcal: parseNumber(row.kcal),
      protein: parseNumber(row.protein),
      carbs: parseNumber(row.karbohydrater ?? row.carbs),
      fat: parseNumber(row.fett ?? row.fat),
      fiber: parseNumber(row.kostfiber ?? row.fiber),
      sugar: parseNumber(row.sukker ?? row.sugar),
      saturatedFat: parseNumber(row.mettet_fett ?? row.saturated_fat),
      sodium: parseNumber(row.natrium_mg ?? row.sodium),
      micronutrients: micronutrientsFromCsvRow(row),
    },
  };
}

export function parseMotusCsv(text: string, trainerName: string): FoodImportParseResult {
  const errors: string[] = [];
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) return { items: [], errors: ["Filen er tom."], format: "motus-csv" };

  const delimiter = detectDelimiter(lines[0]);
  const headers = parseCsvLine(lines[0], delimiter).map((cell) => cell.trim().toLowerCase());
  const items: FoodItem[] = [];

  for (let i = 1; i < lines.length; i += 1) {
    const cells = parseCsvLine(lines[i], delimiter);
    if (cells.every((cell) => !cell.trim())) continue;
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = cells[index] ?? "";
    });
    const item = rowToFoodItem(row, trainerName, i + 1, errors);
    if (item) items.push(item);
  }

  return { items, errors, format: "motus-csv" };
}

function isFoodItem(value: unknown): value is FoodItem {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<FoodItem>;
  return typeof row.name === "string" && row.nutritionPer100g != null;
}

export function parseMotusJson(text: string, trainerName: string): FoodImportParseResult {
  const errors: string[] = [];
  try {
    const parsed = JSON.parse(text) as unknown;
    const rows = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === "object" && Array.isArray((parsed as { items?: unknown }).items)
        ? (parsed as { items: unknown[] }).items
        : null;
    if (!rows) return { items: [], errors: ["JSON må være en liste eller { \"items\": [...] }."], format: "motus-json" };

    const items = rows
      .map((row, index) => {
        if (!isFoodItem(row)) {
          errors.push(`Rad ${index + 1}: ugyldig matvareformat.`);
          return null;
        }
        const source = row.source && VALID_SOURCES.has(row.source) ? row.source : "egen";
        return {
          ...row,
          id: row.id?.trim() || stableImportId(row.name, source),
          createdBy: row.createdBy?.trim() || trainerName,
          createdAt: row.createdAt?.trim() || new Date().toISOString(),
          isCustom: row.isCustom ?? source === "egen",
        } satisfies FoodItem;
      })
      .filter((row): row is FoodItem => row !== null);

    return { items, errors, format: "motus-json" };
  } catch {
    return { items: [], errors: ["Kunne ikke lese JSON."], format: "motus-json" };
  }
}

export function parseMatvaretabellenJson(text: string, trainerName: string): FoodImportParseResult {
  const errors: string[] = [];
  try {
    const parsed = JSON.parse(text) as { foods?: MatvaretabellenFood[] };
    const foods = Array.isArray(parsed.foods) ? parsed.foods : Array.isArray(parsed) ? (parsed as MatvaretabellenFood[]) : [];
    if (!foods.length) return { items: [], errors: ["Fant ingen matvarer i Matvaretabellen-filen."], format: "matvaretabellen" };

    const items = foods
      .map((food) => mapMatvaretabellenFood(food, trainerName))
      .filter((row): row is FoodItem => row !== null);

    return { items, errors, format: "matvaretabellen" };
  } catch {
    return { items: [], errors: ["Kunne ikke lese Matvaretabellen JSON."], format: "matvaretabellen" };
  }
}

export function parseFoodImportText(text: string, fileName: string, trainerName: string): FoodImportParseResult {
  const lower = fileName.trim().toLowerCase();
  if (lower.endsWith(".csv")) return parseMotusCsv(text, trainerName);
  if (lower.endsWith(".json")) {
    const trimmed = text.trim();
    if (trimmed.includes('"foods"') || trimmed.startsWith('{"foods"')) {
      return parseMatvaretabellenJson(text, trainerName);
    }
    return parseMotusJson(text, trainerName);
  }
  if (text.trim().startsWith("{") || text.trim().startsWith("[")) {
    const mat = parseMatvaretabellenJson(text, trainerName);
    if (mat.items.length) return mat;
    return parseMotusJson(text, trainerName);
  }
  return parseMotusCsv(text, trainerName);
}

export function mergeFoodImports(
  existing: FoodItem[],
  imported: FoodItem[],
  mode: FoodImportMergeMode,
): FoodImportMergeResult {
  const byKey = new Map<string, number>();
  existing.forEach((item, index) => byKey.set(foodMatchKey(item), index));

  const next = [...existing];
  let added = 0;
  let updated = 0;
  let skipped = 0;

  for (const candidate of imported) {
    const key = foodMatchKey(candidate);
    const index = byKey.get(key);
    if (index === undefined) {
      next.unshift(candidate);
      byKey.set(key, 0);
      for (let i = 1; i < next.length; i += 1) byKey.set(foodMatchKey(next[i]), i);
      added += 1;
      continue;
    }
    if (mode === "skip") {
      skipped += 1;
      continue;
    }
    const previous = next[index];
    next[index] = {
      ...candidate,
      id: previous.id,
      createdAt: previous.createdAt,
      createdBy: previous.createdBy,
      isCustom: previous.isCustom || candidate.isCustom,
      isEdited: previous.isEdited || candidate.isEdited || previous.isCustom !== true,
    };
    updated += 1;
  }

  return { items: next, added, updated, skipped };
}

export async function fetchMatvaretabellenFoods(signal?: AbortSignal): Promise<MatvaretabellenFood[]> {
  const response = await fetch(MATVARETABELLEN_FOODS_URL, { signal });
  if (!response.ok) throw new Error(`Matvaretabellen svarte ${response.status}`);
  const payload = (await response.json()) as { foods?: MatvaretabellenFood[] };
  if (!Array.isArray(payload.foods)) throw new Error("Uventet format fra Matvaretabellen.");
  return payload.foods;
}

export function filterMatvaretabellenFoods(foods: MatvaretabellenFood[], query: string): MatvaretabellenFood[] {
  const tokens = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (!tokens.length) return foods;
  return foods.filter((food) => {
    const name = String(food.foodName ?? "").toLowerCase();
    return tokens.every((token) => name.includes(token));
  });
}

export function downloadFoodImportTemplate(): void {
  const blob = new Blob([FOOD_IMPORT_CSV_TEMPLATE], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "motus-matvare-import-mal.csv";
  link.click();
  URL.revokeObjectURL(url);
}
