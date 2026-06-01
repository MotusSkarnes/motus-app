import type { FoodMicronutrientKey } from "./foodBankMicronutrients";
import type { NutritionReferenceContext } from "./personalizedNutritionReferences";
import { resolveNutritionReferenceContext } from "./personalizedNutritionReferences";

/** NNR 2023: AR (nedre), RI (anbefalt), UL (øvre) der definert — voksne 25–50 år. */
export type MicronutrientReferenceBounds = {
  lower: number;
  recommended: number;
  upper: number | null;
};

export type MicronutrientStatusCode =
  | "low"
  | "below_recommended"
  | "adequate"
  | "near_upper"
  | "high"
  | "unknown";

export type MicronutrientStatusMeta = {
  code: MicronutrientStatusCode;
  label: string;
  /** CSS-modifier på rapport-rad */
  tone: "danger" | "warn" | "ok" | "muted";
};

const NEAR_UPPER_FRACTION = 0.85;

/** UL felles for voksne (tabell 21, NNR 2023). */
const ADULT_UPPER: Partial<Record<FoodMicronutrientKey, number>> = {
  vitaminA: 3000,
  vitaminD: 100,
  vitaminE: 300,
  vitaminB6: 12,
  folate: 1000,
  calcium: 2500,
  iron: 60,
  zinc: 25,
  copper: 5000,
  iodine: 600,
  selenium: 255,
  phosphorus: 3000,
  magnesium: 250,
};

type SexKey = "female" | "male";

/** Kilde: NNR 2023 tabell 17 (AR), 12/14 (RI), 21 (UL) — aldersgruppe 25–50 år. */
const BOUNDS_25_50: Record<SexKey, Record<FoodMicronutrientKey, MicronutrientReferenceBounds>> = {
  female: {
    vitaminA: { lower: 540, recommended: 700, upper: 3000 },
    vitaminD: { lower: 7.5, recommended: 10, upper: 100 },
    vitaminE: { lower: 8, recommended: 10, upper: 300 },
    vitaminC: { lower: 75, recommended: 95, upper: null },
    vitaminB1: { lower: 0.9, recommended: 1.1, upper: null },
    vitaminB2: { lower: 1.3, recommended: 1.6, upper: null },
    niacin: { lower: 11, recommended: 14, upper: null },
    vitaminB6: { lower: 1.3, recommended: 1.6, upper: 12 },
    folate: { lower: 250, recommended: 330, upper: 1000 },
    vitaminB12: { lower: 3.2, recommended: 4, upper: null },
    calcium: { lower: 750, recommended: 950, upper: 2500 },
    iron: { lower: 9, recommended: 15, upper: 60 },
    potassium: { lower: 2800, recommended: 3500, upper: null },
    magnesium: { lower: 240, recommended: 300, upper: 250 },
    phosphorus: { lower: 420, recommended: 520, upper: 3000 },
    zinc: { lower: 8.1, recommended: 9.7, upper: 25 },
    selenium: { lower: 60, recommended: 75, upper: 255 },
    iodine: { lower: 120, recommended: 150, upper: 600 },
    copper: { lower: 700, recommended: 900, upper: 5000 },
  },
  male: {
    vitaminA: { lower: 630, recommended: 800, upper: 3000 },
    vitaminD: { lower: 7.5, recommended: 10, upper: 100 },
    vitaminE: { lower: 9, recommended: 11, upper: 300 },
    vitaminC: { lower: 90, recommended: 110, upper: null },
    vitaminB1: { lower: 0.9, recommended: 1.2, upper: null },
    vitaminB2: { lower: 1.3, recommended: 1.6, upper: null },
    niacin: { lower: 14, recommended: 18, upper: null },
    vitaminB6: { lower: 1.5, recommended: 1.8, upper: 12 },
    folate: { lower: 250, recommended: 330, upper: 1000 },
    vitaminB12: { lower: 3.2, recommended: 4, upper: null },
    calcium: { lower: 750, recommended: 950, upper: 2500 },
    iron: { lower: 7, recommended: 9, upper: 60 },
    potassium: { lower: 2800, recommended: 3500, upper: null },
    magnesium: { lower: 280, recommended: 350, upper: 250 },
    phosphorus: { lower: 420, recommended: 520, upper: 3000 },
    zinc: { lower: 10.6, recommended: 12.7, upper: 25 },
    selenium: { lower: 70, recommended: 90, upper: 255 },
    iodine: { lower: 120, recommended: 150, upper: 600 },
    copper: { lower: 700, recommended: 900, upper: 5000 },
  },
};

/** Justerte verdier for eldre (51–70 og >70) der NNR avviker. */
function boundsForSenior(sex: SexKey): Record<FoodMicronutrientKey, MicronutrientReferenceBounds> {
  const base = { ...BOUNDS_25_50[sex] };
  base.vitaminD = { lower: 15, recommended: 20, upper: 100 };
  if (sex === "female") {
    base.iron = { lower: 6, recommended: 9, upper: 60 };
    base.calcium = { lower: 750, recommended: 950, upper: 2500 };
  } else {
    base.iron = { lower: 7, recommended: 9, upper: 60 };
  }
  return base;
}

function boundsForTeen(sex: SexKey): Record<FoodMicronutrientKey, MicronutrientReferenceBounds> {
  const base = { ...BOUNDS_25_50[sex] };
  if (sex === "female") {
    base.iron = { lower: 10, recommended: 15, upper: 60 };
    base.calcium = { lower: 980, recommended: 1150, upper: 2500 };
  } else {
    base.iron = { lower: 9, recommended: 11, upper: 60 };
    base.calcium = { lower: 980, recommended: 1150, upper: 2500 };
  }
  return base;
}

function fallbackBounds(
  key: FoodMicronutrientKey,
  recommended: number,
): MicronutrientReferenceBounds {
  const upper = ADULT_UPPER[key] ?? null;
  const lower = recommended > 0 ? recommended * 0.8 : 0;
  return { lower, recommended, upper };
}

export function resolveMicronutrientBounds(
  key: FoodMicronutrientKey,
  context: Pick<NutritionReferenceContext, "micronutrientDaily" | "gender" | "ageYears" | "missingFields">,
): MicronutrientReferenceBounds {
  const recommended = context.micronutrientDaily[key] ?? 0;
  if (context.missingFields.length > 0 || !context.gender) {
    return fallbackBounds(key, recommended);
  }

  const sex = context.gender as SexKey;
  const age = context.ageYears ?? 30;
  let table: Record<FoodMicronutrientKey, MicronutrientReferenceBounds>;
  if (age < 18) table = boundsForTeen(sex);
  else if (age >= 51) table = boundsForSenior(sex);
  else table = BOUNDS_25_50[sex];

  const row = table[key];
  if (!row) return fallbackBounds(key, recommended);
  return {
    lower: row.lower,
    recommended: row.recommended > 0 ? row.recommended : recommended,
    upper: row.upper,
  };
}

export function classifyMicronutrientStatus(
  value: number,
  bounds: MicronutrientReferenceBounds,
): MicronutrientStatusCode {
  const { lower, recommended, upper } = bounds;
  if (recommended <= 0 && value <= 0) return "unknown";
  if (value < lower) return "low";
  if (value < recommended) return "below_recommended";
  if (upper === null || upper <= 0) return "adequate";
  if (value > upper) return "high";
  if (value >= upper * NEAR_UPPER_FRACTION) return "near_upper";
  return "adequate";
}

const STATUS_LABELS: Record<MicronutrientStatusCode, MicronutrientStatusMeta> = {
  low: { code: "low", label: "Under nedre grense (AR)", tone: "danger" },
  below_recommended: { code: "below_recommended", label: "Under anbefalt (RI)", tone: "warn" },
  adequate: { code: "adequate", label: "Innenfor anbefalt område", tone: "ok" },
  near_upper: { code: "near_upper", label: "Nær øvre grense (UL)", tone: "warn" },
  high: { code: "high", label: "Over øvre grense (UL)", tone: "danger" },
  unknown: { code: "unknown", label: "Ingen referanse", tone: "muted" },
};

export function micronutrientStatusMeta(code: MicronutrientStatusCode): MicronutrientStatusMeta {
  return STATUS_LABELS[code];
}

export function resolveMicronutrientStatus(
  value: number,
  key: FoodMicronutrientKey,
  context: Pick<NutritionReferenceContext, "micronutrientDaily" | "gender" | "ageYears" | "missingFields">,
): MicronutrientStatusMeta {
  const bounds = resolveMicronutrientBounds(key, context);
  return micronutrientStatusMeta(classifyMicronutrientStatus(value, bounds));
}

export function resolveMicronutrientBoundsForReport(
  birthDate: string,
  genderInput: unknown,
): (key: FoodMicronutrientKey) => MicronutrientReferenceBounds {
  const context = resolveNutritionReferenceContext(birthDate, genderInput);
  return (key) => resolveMicronutrientBounds(key, context);
}
