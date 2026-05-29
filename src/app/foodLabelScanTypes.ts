import type { FoodCategoryId, FoodItem } from "./foodBankTypes";

export type FoodLabelScanResult = {
  name: string;
  portionLabel: string;
  portionGrams: number;
  category: FoodCategoryId;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  saturatedFat: number;
  sodium: number;
  confidence?: number;
};

export type FoodSubmissionDraft = Pick<
  FoodItem,
  "name" | "portionLabel" | "portionGrams" | "category" | "origin" | "source" | "imageUrl" | "imageEmoji" | "nutritionPer100g"
>;

export type MemberFoodSubmissionStatus = "pending" | "approved" | "rejected";

export type MemberFoodSubmission = {
  id: string;
  memberId: string;
  memberName?: string;
  ownerUserId: string;
  status: MemberFoodSubmissionStatus;
  draftItem: FoodSubmissionDraft;
  labelImageUrl?: string;
  reviewNote?: string;
  approvedFoodId?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export const FOOD_CATEGORY_IDS: FoodCategoryId[] = [
  "proteinkilder",
  "karbohydrater",
  "fettkilder",
  "gronnsaker",
  "frukt-baer",
  "meieriprodukter",
];

export function normalizeFoodCategory(value: unknown): FoodCategoryId {
  const raw = String(value ?? "").trim().toLowerCase();
  if (FOOD_CATEGORY_IDS.includes(raw as FoodCategoryId)) return raw as FoodCategoryId;
  if (raw.includes("protein") || raw.includes("kjøtt") || raw.includes("fisk")) return "proteinkilder";
  if (raw.includes("karb") || raw.includes("brød") || raw.includes("ris")) return "karbohydrater";
  if (raw.includes("fett") || raw.includes("olje") || raw.includes("nøtt")) return "fettkilder";
  if (raw.includes("grønn") || raw.includes("gronnsak")) return "gronnsaker";
  if (raw.includes("frukt") || raw.includes("bær")) return "frukt-baer";
  if (raw.includes("meieri") || raw.includes("melk") || raw.includes("ost")) return "meieriprodukter";
  return "proteinkilder";
}

export function parseFoodLabelScanResult(value: unknown): FoodLabelScanResult | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const num = (key: string) => {
    const parsed = Number(row[key]);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const name = String(row.name ?? "").trim();
  if (!name) return null;
  const portionGrams = Math.max(1, Math.round(num("portionGrams") || 100));
  return {
    name,
    portionLabel: String(row.portionLabel ?? `${portionGrams} g`).trim() || `${portionGrams} g`,
    portionGrams,
    category: normalizeFoodCategory(row.category),
    kcal: num("kcal"),
    protein: num("protein"),
    carbs: num("carbs"),
    fat: num("fat"),
    fiber: num("fiber"),
    sugar: num("sugar"),
    saturatedFat: num("saturatedFat"),
    sodium: num("sodium"),
    confidence: Number.isFinite(Number(row.confidence)) ? Number(row.confidence) : undefined,
  };
}

export function foodSubmissionDraftFromScan(
  scan: FoodLabelScanResult,
  labelImageUrl?: string,
): FoodSubmissionDraft {
  return {
    name: scan.name,
    portionLabel: scan.portionLabel,
    portionGrams: scan.portionGrams,
    category: scan.category,
    origin: "Etikett",
    source: "egen",
    imageUrl: labelImageUrl,
    imageEmoji: "🏷️",
    nutritionPer100g: {
      kcal: scan.kcal,
      protein: scan.protein,
      carbs: scan.carbs,
      fat: scan.fat,
      fiber: scan.fiber,
      sugar: scan.sugar,
      saturatedFat: scan.saturatedFat,
      sodium: scan.sodium,
    },
  };
}

const EMPTY_NUTRITION: FoodItem["nutritionPer100g"] = {
  kcal: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  fiber: 0,
  sugar: 0,
  saturatedFat: 0,
  sodium: 0,
};

/** Godkjent medlemsforslag → matvare i søk/matbank (uten store base64-bilder). */
export function foodItemFromSubmissionDraft(
  draft: FoodSubmissionDraft,
  foodId: string,
  options?: { createdAt?: string; createdBy?: string },
): FoodItem {
  const nutrition = draft.nutritionPer100g ?? EMPTY_NUTRITION;
  const imageUrl = draft.imageUrl?.trim();
  const safeImageUrl =
    imageUrl && !imageUrl.startsWith("data:") && imageUrl.length < 2000 ? imageUrl : undefined;
  return {
    id: foodId,
    name: draft.name.trim(),
    portionLabel: String(draft.portionLabel ?? "100 g").trim() || "100 g",
    portionGrams: Number(draft.portionGrams) > 0 ? Math.round(Number(draft.portionGrams)) : 100,
    category: normalizeFoodCategory(draft.category),
    origin: String(draft.origin ?? "Medlem").trim() || "Medlem",
    source: "egen",
    createdBy: String(options?.createdBy ?? "Medlem").trim() || "Medlem",
    createdAt: options?.createdAt ?? new Date().toISOString(),
    imageUrl: safeImageUrl,
    imageEmoji: draft.imageEmoji ?? "🏷️",
    isCustom: true,
    isEdited: false,
    nutritionPer100g: { ...nutrition },
  };
}
