export const RECIPE_INGREDIENT_UNITS = [
  "g",
  "kg",
  "dl",
  "ss",
  "ts",
  "stk liten",
  "stk",
  "stk stor",
  "skive",
  "brødskive",
  "boks liten",
  "boks",
  "fedd",
  "håndfull",
  "porsjon",
  "glass liten",
  "glass",
  "glass stor",
  "kopp",
  "beger",
  "pakke",
  "pose liten",
  "pose",
  "pose stor",
  "filet",
  "kartong",
  "plate liten",
  "plate",
  "plate stor",
  "bukett",
  "blad",
  "stilk",
  "stang",
  "ring",
  "båt",
  "terning",
] as const;

export type RecipeIngredientUnit = (typeof RECIPE_INGREDIENT_UNITS)[number];

export function recipeIngredientUnitPattern(): string {
  return [...RECIPE_INGREDIENT_UNITS]
    .sort((a, b) => b.length - a.length)
    .map((unit) => unit.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
}
