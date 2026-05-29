import type { FoodItem } from "./foodBankTypes";
import { defaultPortionGramsForFood, defaultPortionLabelForFood } from "./foodPortionDefaults";

export type FoodMeasureMode = "grams" | "portion";

export type FoodMeasureOption = {
  mode: FoodMeasureMode;
  label: string;
  /** Gram per én enhet når mode er portion (f.eks. 200 for «1 dl»). */
  gramsPerUnit: number;
};

export function foodMeasureOptionsForItem(
  food: Pick<FoodItem, "name" | "portionGrams" | "portionLabel"> | null | undefined,
): FoodMeasureOption[] {
  const options: FoodMeasureOption[] = [{ mode: "grams", label: "Gram", gramsPerUnit: 1 }];
  if (!food) return options;
  const gramsPerUnit = defaultPortionGramsForFood(food);
  const portionLabel = defaultPortionLabelForFood(food);
  if (gramsPerUnit > 0 && portionLabel && portionLabel !== `${gramsPerUnit} g`) {
    options.push({ mode: "portion", label: portionLabel, gramsPerUnit });
  }
  return options;
}

export function defaultMeasureModeForFood(
  food: Pick<FoodItem, "name" | "portionGrams" | "portionLabel"> | null | undefined,
): FoodMeasureMode {
  const options = foodMeasureOptionsForItem(food);
  return options.length > 1 ? "portion" : "grams";
}

export function resolveFoodLogGrams(
  food: Pick<FoodItem, "name" | "portionGrams" | "portionLabel">,
  mode: FoodMeasureMode,
  quantity: number,
  gramsPerUnit: number,
): number {
  if (!Number.isFinite(quantity) || quantity <= 0) return 0;
  if (mode === "grams") return Math.round(quantity);
  const unit = gramsPerUnit > 0 ? gramsPerUnit : defaultPortionGramsForFood(food);
  return Math.round(unit * quantity);
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
    if (Number.isInteger(count)) return `${count} × ${portionLabel}`;
  }
  return `${grams} g`;
}
