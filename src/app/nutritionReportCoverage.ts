import { type FoodFattyAcids } from "./foodBankFattyAcids";
import {
  compactMicronutrients,
  FOOD_MICRONUTRIENT_FIELDS,
  isDenseMicronutrientObject,
  readMicronutrientValue,
  type FoodMicronutrientKey,
  type FoodMicronutrients,
} from "./foodBankMicronutrients";
import {
  ALL_CONTRIBUTION_IDS,
  sourceGroupKey,
  type NutrientContributionId,
  type NutritionContributionSource,
} from "./nutritionReportContributors";

export type NutrientCoverage = {
  known: number;
  total: number;
  percent: number;
};

export type NutrientCoverageLookup = Partial<Record<NutrientContributionId, NutrientCoverage>>;

function uniqueSources(sources: NutritionContributionSource[]): NutritionContributionSource[] {
  const seen = new Map<string, NutritionContributionSource>();
  for (const source of sources) {
    const name = source.name.trim();
    if (!name || !(source.grams > 0)) continue;
    const key = sourceGroupKey(source);
    if (!seen.has(key)) seen.set(key, source);
  }
  return [...seen.values()];
}

function hasOwnFinite(object: object | undefined, key: string): boolean {
  if (!object || !Object.prototype.hasOwnProperty.call(object, key)) return false;
  const value = (object as Record<string, unknown>)[key];
  return typeof value === "number" && Number.isFinite(value);
}

function hasKnownFattyAcid(nutrition: NutritionContributionSource["nutritionPer100g"], key: keyof FoodFattyAcids): boolean {
  return hasOwnFinite(nutrition.fattyAcids, key);
}

function shouldTreatDenseZerosAsUnknown(micros: FoodMicronutrients | undefined): boolean {
  if (!isDenseMicronutrientObject(micros)) return false;
  const positive = FOOD_MICRONUTRIENT_FIELDS.filter((field) => Number(micros[field.key]) > 0).length;
  return positive < 8;
}

function microsForCoverage(nutrition: NutritionContributionSource["nutritionPer100g"]): FoodMicronutrients | undefined {
  return compactMicronutrients(nutrition.micronutrients, {
    dropZeros: shouldTreatDenseZerosAsUnknown(nutrition.micronutrients),
  });
}

export function hasKnownNutrientValue(source: NutritionContributionSource, id: NutrientContributionId): boolean {
  const n = source.nutritionPer100g;
  switch (id) {
    case "kcal":
    case "protein":
    case "carbs":
    case "fat":
    case "fiber":
    case "sugar":
    case "saturatedFat":
    case "sodium":
      return true;
    case "waterFromFood":
    case "waterTotal":
      return n.water != null && Number.isFinite(n.water);
    case "drinkWater":
      return false;
    case "monounsaturatedFat":
    case "polyunsaturatedFat":
    case "omega3":
    case "omega6":
    case "epa":
    case "dha":
    case "ala":
      return hasKnownFattyAcid(n, id);
    case "epaDha":
      return hasKnownFattyAcid(n, "epa") && hasKnownFattyAcid(n, "dha");
    default:
      return readMicronutrientValue(microsForCoverage(n), id as FoodMicronutrientKey) !== undefined;
  }
}

export function buildNutrientCoverageLookup(sources: NutritionContributionSource[]): NutrientCoverageLookup {
  const foods = uniqueSources(sources);
  const total = foods.length;
  if (!total) return {};

  const lookup: NutrientCoverageLookup = {};
  for (const id of ALL_CONTRIBUTION_IDS) {
    if (id === "drinkWater") continue;
    const known = foods.filter((source) => hasKnownNutrientValue(source, id)).length;
    lookup[id] = {
      known,
      total,
      percent: Math.round((known / total) * 100),
    };
  }
  return lookup;
}

export function coverageFor(
  lookup: NutrientCoverageLookup | undefined,
  id: NutrientContributionId | undefined,
): NutrientCoverage | undefined {
  if (!lookup || !id) return undefined;
  return lookup[id];
}

export function formatCoveragePercent(coverage: NutrientCoverage | undefined): string {
  if (!coverage || coverage.total <= 0) return "";
  return `${coverage.percent}%`;
}

export function formatCoverageTitle(coverage: NutrientCoverage | undefined): string {
  if (!coverage || coverage.total <= 0) return "";
  return `${coverage.known} av ${coverage.total} matvarer har kjent verdi (0 teller som kjent). Ukjent verdi telles ikke.`;
}

export const NUTRIENT_COVERAGE_FOOTNOTE =
  "Prosent nede til høyre viser andel matvarer med kjent verdi for stoffet. 0 er en målt verdi; tomt felt betyr at vi ikke vet.";
