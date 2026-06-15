export type RecipeProteinCategory = "meat" | "chicken" | "seafood" | "vegetarian";

export const RECIPE_PROTEIN_CATEGORIES: { id: RecipeProteinCategory; label: string }[] = [
  { id: "meat", label: "Kjøtt" },
  { id: "chicken", label: "Kylling" },
  { id: "seafood", label: "Sjømat" },
  { id: "vegetarian", label: "Vegetar" },
];

export type RecipeProteinCategoryFilter = "all" | RecipeProteinCategory;

export const RECIPE_PROTEIN_CATEGORY_FILTERS: { id: RecipeProteinCategoryFilter; label: string }[] = [
  { id: "all", label: "Alle" },
  ...RECIPE_PROTEIN_CATEGORIES,
];

export function isRecipeProteinCategory(value: unknown): value is RecipeProteinCategory {
  return value === "meat" || value === "chicken" || value === "seafood" || value === "vegetarian";
}

function normalizeRecipeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/ø/g, "o")
    .replace(/å/g, "a")
    .replace(/æ/g, "ae");
}

function classifyText(value: string): RecipeProteinCategory | null {
  if (/(laks|torsk|tunfisk|fisk|reker|scampi|sei|orret|makrell|sjomat)/.test(value)) {
    return "seafood";
  }
  if (/(kylling|kyllingfilet|kyllingbryst|kalkun)/.test(value)) {
    return "chicken";
  }
  if (/(kjott|kjottdeig|karbonadedeig|storfe|biff|skinke|leverpostei|svin|svinekjott)/.test(value)) {
    return "meat";
  }
  if (/(vegetar|linse|linser|bonne|bonner|tofu|hummus|cottage cheese|egg|ost|skyr|yoghurt|avokado)/.test(value)) {
    return "vegetarian";
  }
  return null;
}

export function resolveRecipeProteinCategory(input: {
  proteinCategory?: unknown;
  title: string;
  tag?: string;
  description?: string;
  body?: string;
}): RecipeProteinCategory | null {
  if (isRecipeProteinCategory(input.proteinCategory)) return input.proteinCategory;

  const titleCategory = classifyText(normalizeRecipeText(input.title));
  if (titleCategory) return titleCategory;

  return classifyText(
    normalizeRecipeText(`${input.tag ?? ""} ${input.description ?? ""} ${input.body ?? ""}`),
  );
}

export function recipeProteinCategoryLabel(category: RecipeProteinCategory | null | undefined): string {
  if (!category) return "";
  return RECIPE_PROTEIN_CATEGORIES.find((item) => item.id === category)?.label ?? category;
}
