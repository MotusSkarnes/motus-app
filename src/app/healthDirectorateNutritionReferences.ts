import type { FoodMicronutrientKey } from "./foodBankMicronutrients";

/** Generelle daglige referanseverdier for voksne (Helsedirektoratet / Matvaretabellen). */
export const HEALTH_DIRECTORATE_MICRONUTRIENT_DAILY: Record<FoodMicronutrientKey, number> = {
  vitaminA: 700,
  vitaminD: 10,
  vitaminE: 8,
  vitaminC: 75,
  vitaminB1: 1.1,
  vitaminB2: 1.3,
  niacin: 14,
  vitaminB6: 1.4,
  folate: 300,
  vitaminB12: 2,
  calcium: 800,
  iron: 9,
  potassium: 3500,
  magnesium: 350,
  phosphorus: 600,
  zinc: 9,
  selenium: 50,
  iodine: 150,
  copper: 0.9,
};

/** 1 MJ = 1000 kJ, 1 kJ = 0,239 kcal (Helsedirektoratet). */
export function kcalFromMegajoule(mj: number): number {
  return Math.round(mj * 239);
}

export function gramsFromEnergyPercent(kcal: number, energyPercent: number, kcalPerGram: number): number {
  if (!(kcal > 0) || !(kcalPerGram > 0) || !(energyPercent > 0)) return 0;
  return (kcal * energyPercent) / 100 / kcalPerGram;
}

/**
 * Anbefalte E%-intervaller for voksne og barn fra 2 år (Helsedirektoratet / NNR 2023).
 * «recommended» er planleggingsnivået de oppgir for grupper.
 */
export const HEALTH_DIRECTORATE_MACRO_ENERGY_PERCENT = {
  protein: { min: 10, recommended: 15, max: 20, kcalPerGram: 4 },
  carbs: { min: 45, recommended: 52.5, max: 60, kcalPerGram: 4 },
  fat: { min: 25, recommended: 32.5, max: 40, kcalPerGram: 9 },
  monounsaturatedFat: { min: 10, recommended: 15, max: 20, kcalPerGram: 9 },
  polyunsaturatedFat: { min: 5, recommended: 7.5, max: 10, kcalPerGram: 9 },
  saturatedFatMax: 10,
  sugarMax: 10,
} as const;

export type HealthDirectorateOtherDaily = {
  /** Kostfiber, minst g/dag. Kvinner 25 g, menn 35 g. */
  fiber: number;
  /** Øvre grense natrium, mg/dag (2,3 g for voksne). */
  sodium: number;
  /** Fallback for mettet fett i gram (10 E% av kcalPal16). */
  saturatedFat: number;
  /** Adekvat totalt vanninntak, L/dag (2,0 kvinner / 2,5 menn). */
  waterLiters: number;
  /** Referanseenergi ved PAL 1,6, kcal/dag. */
  kcalPal16: number;
};

const ADULT_FEMALE_KCAL = kcalFromMegajoule(9.0);

export const HEALTH_DIRECTORATE_OTHER_DAILY: HealthDirectorateOtherDaily = {
  fiber: 25,
  sodium: 2300,
  saturatedFat: Math.round(gramsFromEnergyPercent(ADULT_FEMALE_KCAL, 10, 9)),
  waterLiters: 2,
  kcalPal16: ADULT_FEMALE_KCAL,
};

/** @deprecated Bruk HEALTH_DIRECTORATE_MICRONUTRIENT_DAILY */
export const MICRONUTRIENT_DAILY_TARGETS = HEALTH_DIRECTORATE_MICRONUTRIENT_DAILY;
