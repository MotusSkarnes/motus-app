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

export const HEALTH_DIRECTORATE_OTHER_DAILY = {
  fiber: 25,
  sodium: 2400,
  saturatedFat: 20,
} as const;

/** @deprecated Bruk HEALTH_DIRECTORATE_MICRONUTRIENT_DAILY */
export const MICRONUTRIENT_DAILY_TARGETS = HEALTH_DIRECTORATE_MICRONUTRIENT_DAILY;
