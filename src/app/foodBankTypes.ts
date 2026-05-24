export type FoodCategoryId =
  | "proteinkilder"
  | "karbohydrater"
  | "fettkilder"
  | "gronnsaker"
  | "frukt-baer"
  | "meieriprodukter";

export type FoodSource = "matvaretabell" | "usda" | "egen";

export type FoodNutrition = {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  saturatedFat: number;
  sodium: number;
};

export type FoodItem = {
  id: string;
  name: string;
  portionLabel: string;
  portionGrams: number;
  category: FoodCategoryId;
  origin: string;
  source: FoodSource;
  createdBy: string;
  createdAt: string;
  imageUrl?: string;
  imageEmoji?: string;
  isCustom?: boolean;
  nutritionPer100g: FoodNutrition;
};

export type FoodBankFilterChip =
  | "all"
  | "favorites"
  | "mine"
  | "recent"
  | FoodCategoryId;

export type FoodMacroFilter = {
  kcalMin: string;
  kcalMax: string;
  proteinMin: string;
  proteinMax: string;
  carbsMin: string;
  carbsMax: string;
  fatMin: string;
  fatMax: string;
};

export const EMPTY_MACRO_FILTER: FoodMacroFilter = {
  kcalMin: "",
  kcalMax: "",
  proteinMin: "",
  proteinMax: "",
  carbsMin: "",
  carbsMax: "",
  fatMin: "",
  fatMax: "",
};

export type FoodBankCategoryMeta = {
  id: FoodCategoryId;
  label: string;
  originHint: string;
  accent: string;
  emoji: string;
};

export const FOOD_BANK_CATEGORIES: FoodBankCategoryMeta[] = [
  { id: "proteinkilder", label: "Proteinkilder", originHint: "Kjøtt & fjærkre", accent: "#0d9488", emoji: "🍗" },
  { id: "karbohydrater", label: "Karbohydrater", originHint: "Korn & belgfrukter", accent: "#d97706", emoji: "🍚" },
  { id: "fettkilder", label: "Fettkilder", originHint: "Olje & nøtter", accent: "#7c3aed", emoji: "🥑" },
  { id: "gronnsaker", label: "Grønnsaker", originHint: "Grønnsaker", accent: "#16a34a", emoji: "🥦" },
  { id: "frukt-baer", label: "Frukt & bær", originHint: "Frukt", accent: "#db2777", emoji: "🍎" },
  { id: "meieriprodukter", label: "Meieriprodukter", originHint: "Meieri", accent: "#2563eb", emoji: "🥛" },
];

export function foodCategoryMeta(category: FoodCategoryId): FoodBankCategoryMeta {
  return FOOD_BANK_CATEGORIES.find((row) => row.id === category) ?? FOOD_BANK_CATEGORIES[0];
}

export function foodSourceLabel(source: FoodSource): string {
  if (source === "matvaretabell") return "Norsk matvaretabell";
  if (source === "usda") return "USDA";
  return "Egen";
}

export function formatMacro(value: number, decimals = 0): string {
  if (!Number.isFinite(value)) return "0";
  return decimals > 0 ? value.toFixed(decimals) : String(Math.round(value));
}
