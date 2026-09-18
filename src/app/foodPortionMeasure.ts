import type { FoodItem } from "./foodBankTypes";
import { defaultPortionGramsForFood, defaultPortionLabelForFood } from "./foodPortionDefaults";
import {
  inferredUnitGramsFromPortion,
  registeredGramsPerUnit,
  registeredRecipeUnitsForFood,
} from "./foodUnitGrams";

export type FoodLogUnitOption = {
  unit: string;
  label: string;
  gramsPerUnit: number;
};

/** @deprecated Use FoodLogUnitOption.unit === "g" instead. */
export type FoodMeasureMode = "grams" | "portion";

export type FoodMeasureOption = {
  mode: FoodMeasureMode;
  label: string;
  gramsPerUnit: number;
};

export function foodLogUnitOptionsForItem(
  food: Pick<FoodItem, "name" | "portionGrams" | "portionLabel" | "unitGrams"> | null | undefined,
): FoodLogUnitOption[] {
  const options: FoodLogUnitOption[] = [];
  const seen = new Set<string>();

  function add(unit: string, label: string, gramsPerUnit: number) {
    if (!unit || !Number.isFinite(gramsPerUnit) || gramsPerUnit <= 0 || seen.has(unit)) return;
    seen.add(unit);
    options.push({ unit, label, gramsPerUnit });
  }

  add("g", "g", 1);
  if (!food) return options;

  for (const unit of registeredRecipeUnitsForFood(food)) {
    const gramsPerUnit = registeredGramsPerUnit(food, unit);
    if (gramsPerUnit == null) continue;
    add(unit, unit, gramsPerUnit);
  }

  const portionGrams = defaultPortionGramsForFood(food);
  const portionLabel = defaultPortionLabelForFood(food).trim();
  if (portionGrams > 0 && portionLabel && portionLabel !== `${portionGrams} g` && !seen.has("porsjon")) {
    const alreadyCovered = options.some(
      (option) => option.unit !== "g" && option.unit !== "kg" && Math.abs(option.gramsPerUnit - portionGrams) < 0.51,
    );
    if (!alreadyCovered) add("porsjon", portionLabel, portionGrams);
  }

  return options;
}

export function defaultFoodLogUnitForItem(
  food: Pick<FoodItem, "name" | "portionGrams" | "portionLabel" | "unitGrams"> | null | undefined,
): string {
  const options = foodLogUnitOptionsForItem(food);
  if (!food) return "g";
  const inferred = inferredUnitGramsFromPortion(food);
  const preferred = Object.keys(inferred).find((unit) => options.some((option) => option.unit === unit));
  if (preferred) return preferred;
  if (options.some((option) => option.unit === "porsjon")) return "porsjon";
  return "g";
}

export function defaultFoodLogQuantityForUnit(
  food: Pick<FoodItem, "name" | "portionGrams" | "portionLabel" | "unitGrams"> | null | undefined,
  unit: string,
): string {
  if (!food || unit === "g") return String(defaultPortionGramsForFood(food));
  if (unit === "kg") {
    const grams = defaultPortionGramsForFood(food);
    const kilos = grams / 1000;
    return Number.isInteger(kilos) ? String(kilos) : String(Math.round(kilos * 1000) / 1000);
  }
  const inferred = inferredUnitGramsFromPortion(food)[unit];
  const portionGrams = defaultPortionGramsForFood(food);
  if (inferred && inferred > 0 && portionGrams > 0) {
    const count = portionGrams / inferred;
    if (Number.isFinite(count) && count > 0) {
      const rounded = Math.round(count * 10) / 10;
      return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(".", ",");
    }
  }
  return "1";
}

export function foodMeasureOptionsForItem(
  food: Pick<FoodItem, "name" | "portionGrams" | "portionLabel" | "unitGrams"> | null | undefined,
): FoodMeasureOption[] {
  const units = foodLogUnitOptionsForItem(food);
  const grams = units.find((option) => option.unit === "g");
  const options: FoodMeasureOption[] = [
    { mode: "grams", label: "Gram", gramsPerUnit: grams?.gramsPerUnit ?? 1 },
  ];
  const household = units.find((option) => option.unit !== "g" && option.unit !== "kg");
  if (household) {
    options.push({ mode: "portion", label: household.label, gramsPerUnit: household.gramsPerUnit });
  }
  return options;
}

export function defaultMeasureModeForFood(
  food: Pick<FoodItem, "name" | "portionGrams" | "portionLabel" | "unitGrams"> | null | undefined,
): FoodMeasureMode {
  return defaultFoodLogUnitForItem(food) === "g" ? "grams" : "portion";
}

export function resolveFoodLogGrams(
  food: Pick<FoodItem, "name" | "portionGrams" | "portionLabel" | "unitGrams">,
  mode: FoodMeasureMode,
  quantity: number,
  gramsPerUnit: number,
): number {
  return resolveFoodLogGramsForUnit(quantity, mode === "grams" ? 1 : gramsPerUnit);
}

export function resolveFoodLogGramsForUnit(quantity: number, gramsPerUnit: number): number {
  if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(gramsPerUnit) || gramsPerUnit <= 0) return 0;
  return Math.round(quantity * gramsPerUnit);
}

export function formatLoggedQuantityLabel(
  food: Pick<FoodItem, "name" | "portionGrams" | "portionLabel">,
  grams: number,
): string {
  const portionGrams = defaultPortionGramsForFood(food);
  const portionLabel = defaultPortionLabelForFood(food);
  if (portionGrams > 0 && grams > 0 && grams % portionGrams === 0) {
    const count = grams / portionGrams;
    if (count === 1) return portionLabel;
    if (Number.isInteger(count) && count <= 24) return `${count} × ${portionLabel}`;
  }
  return `${grams} g`;
}
