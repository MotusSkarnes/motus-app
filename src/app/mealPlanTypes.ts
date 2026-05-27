import type { FoodNutrition } from "./foodBankTypes";

export type MealPlanTargets = {
  kcal?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
};

export type MealPlanFoodEntry = {
  id: string;
  foodId: string;
  foodName: string;
  grams: number;
  note?: string;
  /** Snapshot ved lagring — medlem trenger ikke matvarebank. */
  nutritionPer100g: FoodNutrition;
};

export type MealPlanMeal = {
  id: string;
  name: string;
  time?: string;
  items: MealPlanFoodEntry[];
};

export type MealPlanDay = {
  id: string;
  label: string;
  meals: MealPlanMeal[];
};

export type MealPlan = {
  id: string;
  memberId: string;
  title: string;
  notes: string;
  days: MealPlanDay[];
  targets?: MealPlanTargets;
  createdAt: string;
  updatedAt?: string;
};
