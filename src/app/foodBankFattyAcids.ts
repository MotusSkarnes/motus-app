/** Utvidede fettsyrer per 100 g (Matvaretabellen / beriket matbank). */
export type FoodFattyAcids = {
  monounsaturatedFat: number;
  polyunsaturatedFat: number;
  omega3: number;
  omega6: number;
  epa: number;
  dha: number;
  ala: number;
};

export const EMPTY_FATTY_ACIDS: FoodFattyAcids = {
  monounsaturatedFat: 0,
  polyunsaturatedFat: 0,
  omega3: 0,
  omega6: 0,
  epa: 0,
  dha: 0,
  ala: 0,
};

type MatvaretabellenConstituent = { nutrientId?: string; quantity?: number; unit?: string };

function constituentGrams(
  constituents: MatvaretabellenConstituent[] | undefined,
  nutrientId: string,
): number {
  const row = constituents?.find((entry) => entry.nutrientId === nutrientId);
  if (!row || row.quantity === undefined || !Number.isFinite(row.quantity)) return 0;
  const unit = (row.unit ?? "g").toLowerCase().replace("µ", "u");
  if (unit === "mg") return row.quantity / 1000;
  if (unit === "ug") return row.quantity / 1_000_000;
  return row.quantity;
}

/** Henter fettsyrer fra Matvaretabellen (Omega-3/6, EPA, DHA, m.m.). */
export function fattyAcidsFromMatvaretabellen(
  constituents: MatvaretabellenConstituent[] | undefined,
  totalFatGrams = 0,
  saturatedFatGrams = 0,
): FoodFattyAcids {
  const omega3 = constituentGrams(constituents, "Omega-3");
  const omega6 = constituentGrams(constituents, "Omega-6");
  const epa = constituentGrams(constituents, "C20:5n-3Eikosapentaensyre");
  const dha = constituentGrams(constituents, "C22:6n-3Dokosaheksaensyre");
  const ala = constituentGrams(constituents, "C18:3n-3AlfaLinolensyre");
  const c181 = constituentGrams(constituents, "C18:1");

  const polyunsaturatedFat = omega3 + omega6 > 0 ? omega3 + omega6 : 0;
  const monounsaturatedFat =
    c181 > 0
      ? c181
      : Math.max(0, totalFatGrams - saturatedFatGrams - polyunsaturatedFat);

  return {
    monounsaturatedFat,
    polyunsaturatedFat,
    omega3,
    omega6,
    epa,
    dha,
    ala,
  };
}

export function normalizeFattyAcids(partial?: Partial<FoodFattyAcids> | null): FoodFattyAcids {
  if (!partial) return { ...EMPTY_FATTY_ACIDS };
  return {
    monounsaturatedFat: Number(partial.monounsaturatedFat) || 0,
    polyunsaturatedFat: Number(partial.polyunsaturatedFat) || 0,
    omega3: Number(partial.omega3) || 0,
    omega6: Number(partial.omega6) || 0,
    epa: Number(partial.epa) || 0,
    dha: Number(partial.dha) || 0,
    ala: Number(partial.ala) || 0,
  };
}

export function hasFattyAcidData(fattyAcids: FoodFattyAcids): boolean {
  return (
    fattyAcids.monounsaturatedFat > 0 ||
    fattyAcids.polyunsaturatedFat > 0 ||
    fattyAcids.omega3 > 0 ||
    fattyAcids.omega6 > 0
  );
}

export function mergeFoodNutritionFattyAcids(
  nutrition: { fat?: number; saturatedFat?: number; fattyAcids?: Partial<FoodFattyAcids> },
): FoodFattyAcids {
  const base = normalizeFattyAcids(nutrition.fattyAcids);
  if (hasFattyAcidData(base)) return base;
  return base;
}
