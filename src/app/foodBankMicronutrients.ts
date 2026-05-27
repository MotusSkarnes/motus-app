export type FoodMicronutrientKey =
  | "vitaminA"
  | "vitaminD"
  | "vitaminE"
  | "vitaminC"
  | "vitaminB1"
  | "vitaminB2"
  | "niacin"
  | "vitaminB6"
  | "folate"
  | "vitaminB12"
  | "calcium"
  | "iron"
  | "potassium"
  | "magnesium"
  | "phosphorus"
  | "zinc"
  | "selenium"
  | "iodine"
  | "copper";

export type FoodMicronutrients = Record<FoodMicronutrientKey, number>;

export type FoodMicronutrientMeta = {
  key: FoodMicronutrientKey;
  label: string;
  unit: string;
  decimals: number;
  matvaretabellId: string;
  group: "vitamins" | "minerals";
};

export const FOOD_MICRONUTRIENT_FIELDS: FoodMicronutrientMeta[] = [
  { key: "vitaminA", label: "Vitamin A", unit: "µg", decimals: 0, matvaretabellId: "Vit A", group: "vitamins" },
  { key: "vitaminD", label: "Vitamin D", unit: "µg", decimals: 1, matvaretabellId: "Vit D", group: "vitamins" },
  { key: "vitaminE", label: "Vitamin E", unit: "mg", decimals: 1, matvaretabellId: "Vit E", group: "vitamins" },
  { key: "vitaminC", label: "Vitamin C", unit: "mg", decimals: 1, matvaretabellId: "Vit C", group: "vitamins" },
  { key: "vitaminB1", label: "Vitamin B1", unit: "mg", decimals: 2, matvaretabellId: "Vit B1", group: "vitamins" },
  { key: "vitaminB2", label: "Vitamin B2", unit: "mg", decimals: 2, matvaretabellId: "Vit B2", group: "vitamins" },
  { key: "niacin", label: "Niacin (B3)", unit: "mg", decimals: 1, matvaretabellId: "Niacin", group: "vitamins" },
  { key: "vitaminB6", label: "Vitamin B6", unit: "mg", decimals: 2, matvaretabellId: "Vit B6", group: "vitamins" },
  { key: "folate", label: "Folat (B9)", unit: "µg", decimals: 0, matvaretabellId: "Folat", group: "vitamins" },
  { key: "vitaminB12", label: "Vitamin B12", unit: "µg", decimals: 1, matvaretabellId: "Vit B12", group: "vitamins" },
  { key: "calcium", label: "Kalsium", unit: "mg", decimals: 0, matvaretabellId: "Ca", group: "minerals" },
  { key: "iron", label: "Jern", unit: "mg", decimals: 1, matvaretabellId: "Fe", group: "minerals" },
  { key: "potassium", label: "Kalium", unit: "mg", decimals: 0, matvaretabellId: "K", group: "minerals" },
  { key: "magnesium", label: "Magnesium", unit: "mg", decimals: 0, matvaretabellId: "Mg", group: "minerals" },
  { key: "phosphorus", label: "Fosfor", unit: "mg", decimals: 0, matvaretabellId: "P", group: "minerals" },
  { key: "zinc", label: "Sink", unit: "mg", decimals: 1, matvaretabellId: "Zn", group: "minerals" },
  { key: "selenium", label: "Selen", unit: "µg", decimals: 0, matvaretabellId: "Se", group: "minerals" },
  { key: "iodine", label: "Jod", unit: "µg", decimals: 0, matvaretabellId: "I", group: "minerals" },
  { key: "copper", label: "Kobber", unit: "mg", decimals: 2, matvaretabellId: "Cu", group: "minerals" },
];

export const EMPTY_MICRONUTRIENTS: FoodMicronutrients = Object.fromEntries(
  FOOD_MICRONUTRIENT_FIELDS.map((field) => [field.key, 0]),
) as FoodMicronutrients;

const CSV_COLUMN_BY_KEY: Record<FoodMicronutrientKey, string> = {
  vitaminA: "vitamin_a_ug",
  vitaminD: "vitamin_d_ug",
  vitaminE: "vitamin_e_mg",
  vitaminC: "vitamin_c_mg",
  vitaminB1: "vitamin_b1_mg",
  vitaminB2: "vitamin_b2_mg",
  niacin: "niacin_mg",
  vitaminB6: "vitamin_b6_mg",
  folate: "folat_ug",
  vitaminB12: "vitamin_b12_ug",
  calcium: "kalsium_mg",
  iron: "jern_mg",
  potassium: "kalium_mg",
  magnesium: "magnesium_mg",
  phosphorus: "fosfor_mg",
  zinc: "sink_mg",
  selenium: "selen_ug",
  iodine: "jod_ug",
  copper: "kobber_mg",
};

type MatvaretabellenConstituent = { nutrientId?: string; quantity?: number; unit?: string };

function normalizeUnit(unit: string): string {
  return unit.trim().toLowerCase().replace("µ", "u");
}

export function convertNutrientAmount(amount: number, fromUnit: string, toUnit: string): number {
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

export function parseMatvaretabellenConstituent(
  constituents: MatvaretabellenConstituent[] | undefined,
  nutrientId: string,
  targetUnit: string,
): number {
  const row = constituents?.find((entry) => entry.nutrientId === nutrientId);
  if (!row || row.quantity === undefined || !Number.isFinite(row.quantity)) return 0;
  return convertNutrientAmount(row.quantity, row.unit ?? targetUnit, targetUnit);
}

export function micronutrientsFromMatvaretabellen(
  constituents: MatvaretabellenConstituent[] | undefined,
): FoodMicronutrients {
  const result = { ...EMPTY_MICRONUTRIENTS };
  for (const field of FOOD_MICRONUTRIENT_FIELDS) {
    const unit = field.unit === "µg" ? "ug" : field.unit;
    result[field.key] = parseMatvaretabellenConstituent(constituents, field.matvaretabellId, unit);
  }
  return result;
}

export function micronutrientsFromCsvRow(row: Record<string, string>): FoodMicronutrients {
  const result = { ...EMPTY_MICRONUTRIENTS };
  for (const field of FOOD_MICRONUTRIENT_FIELDS) {
    const column = CSV_COLUMN_BY_KEY[field.key];
    const raw = row[column];
    if (raw === undefined || raw === "") continue;
    const parsed = Number(String(raw).trim().replace(",", "."));
    if (Number.isFinite(parsed)) result[field.key] = parsed;
  }
  return result;
}

export function normalizeMicronutrients(value: Partial<FoodMicronutrients> | undefined): FoodMicronutrients {
  const result = { ...EMPTY_MICRONUTRIENTS };
  if (!value) return result;
  for (const field of FOOD_MICRONUTRIENT_FIELDS) {
    const amount = value[field.key];
    if (typeof amount === "number" && Number.isFinite(amount)) {
      result[field.key] = amount;
    }
  }
  return result;
}

export function hasMicronutrientData(micronutrients: FoodMicronutrients | undefined): boolean {
  if (!micronutrients) return false;
  return FOOD_MICRONUTRIENT_FIELDS.some((field) => micronutrients[field.key] > 0);
}

export function formatMicronutrientValue(value: number, decimals: number): string {
  if (!Number.isFinite(value) || value <= 0) return "–";
  if (decimals <= 0) return String(Math.round(value));
  return value.toFixed(decimals).replace(/\.?0+$/, "");
}

export function micronutrientCsvHeaderColumns(): string {
  return FOOD_MICRONUTRIENT_FIELDS.map((field) => CSV_COLUMN_BY_KEY[field.key]).join(";");
}
