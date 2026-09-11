import type { FoodNutrition } from "./foodBankTypes";

/** Matvaretabellen: salt (NaCl) g = natrium mg × 2,5 / 1000. */
const SODIUM_TO_NACL = 2.5;
const MINERAL_MASS_G_THRESHOLD = 10;
const MACRO_G_THRESHOLD = 8;
const IMPLAUSIBLE_WATER_G = 40;

function energyYieldingGrams(nutrition: FoodNutrition): number {
  return (
    (Number(nutrition.protein) || 0) +
    (Number(nutrition.fat) || 0) +
    (Number(nutrition.carbs) || 0) +
    (Number(nutrition.fiber) || 0)
  );
}

/** Ash/mineral mass Matvaretabellen leaves out of water-by-difference (MI0142). */
export function mineralMassGrams(nutrition: FoodNutrition): number {
  const nacl = ((Number(nutrition.sodium) || 0) / 1000) * SODIUM_TO_NACL;
  const micros = nutrition.micronutrients;
  const extraMg =
    (Number(micros?.potassium) || 0) +
    (Number(micros?.magnesium) || 0) +
    (Number(micros?.calcium) || 0) +
    (Number(micros?.phosphorus) || 0);
  return nacl + extraMg / 1000;
}

/**
 * Water g / 100 g for ranking and intake.
 * Matvaretabellen sets WATER = 100 − protein − fat − carbs − fiber − alcohol and never
 * subtracts minerals, so salt/natron get water = 100. Treat those as dry.
 */
export function foodWaterPer100g(nutrition: FoodNutrition | undefined): number | undefined {
  if (!nutrition || nutrition.water == null || !Number.isFinite(nutrition.water)) return undefined;
  const stored = nutrition.water;
  const macros = energyYieldingGrams(nutrition);
  const minerals = mineralMassGrams(nutrition);
  if (stored >= IMPLAUSIBLE_WATER_G && minerals >= MINERAL_MASS_G_THRESHOLD && macros < MACRO_G_THRESHOLD) {
    return 0;
  }
  return stored;
}
