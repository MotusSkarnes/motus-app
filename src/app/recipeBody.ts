import {
  extractRecipeIngredientLines,
  parseIngredientLine,
  parseRecipeServings,
  type RecipeIngredientFoodOverrides,
} from "./recipeMacros";

export const RECIPE_INGREDIENT_UNITS = [
  "g",
  "kg",
  "dl",
  "ss",
  "ts",
  "stk",
  "skive",
  "boks",
  "fedd",
  "håndfull",
] as const;

export type RecipeIngredientUnit = (typeof RECIPE_INGREDIENT_UNITS)[number];

export type RecipeIngredientDraft = {
  id: string;
  quantity: string;
  unit: string;
  name: string;
  foodId?: string;
};

function formatDraftQuantity(value: number): string {
  if (Math.abs(value - Math.round(value)) < 0.05) return String(Math.round(value));
  return value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "").replace(".", ",");
}

/** Kort visningsnavn når matvaren i banken har langt, kronglete navn. */
export function suggestRecipeDisplayName(foodName: string): string {
  const trimmed = foodName.trim();
  if (!trimmed) return "";
  const beforeComma = trimmed.split(",")[0]?.trim() ?? trimmed;
  return beforeComma || trimmed;
}

export function formatRecipeIngredientLine(row: RecipeIngredientDraft): string {
  const qty = row.quantity.trim().replace(".", ",");
  const unit = row.unit.trim();
  const name = row.name.trim();
  if (!name) return "";
  if (qty && unit) return `${qty} ${unit} ${name}`;
  if (qty) return `${qty} ${name}`;
  return name;
}

export function parseRecipeIngredientDrafts(
  body: string,
  overrides?: RecipeIngredientFoodOverrides,
): RecipeIngredientDraft[] {
  return extractRecipeIngredientLines(body, { forEditor: true }).map((line, index) => {
    const parsed = parseIngredientLine(line);
    const quantityValue = parsed?.quantity ?? parsed?.grams;
    const unit =
      parsed?.unit ||
      (parsed?.grams != null && parsed.quantity == null ? "g" : "");
    const foodId = overrides?.[`ing-${index}`]?.trim();
    return {
      id: `draft-${index}`,
      quantity: quantityValue != null ? formatDraftQuantity(quantityValue) : "",
      unit,
      name: parsed?.searchText || line,
      ...(foodId ? { foodId } : {}),
    };
  });
}

export function overridesFromIngredientDrafts(
  ingredients: RecipeIngredientDraft[],
): RecipeIngredientFoodOverrides {
  const result: RecipeIngredientFoodOverrides = {};
  ingredients.forEach((row, index) => {
    const foodId = row.foodId?.trim();
    if (foodId) result[`ing-${index}`] = foodId;
  });
  return result;
}

const METHOD_SECTION_MARKER =
  /\*\*Slik gjør du\*\*|(?:^|\n)#{1,3}\s*Slik gjør du\b|(?:^|\n)Slik gjør du\s*:?\s*(?:\n|$)|(?:^|\n)Fremgangsmåte\b|(?:^|\n)Fremgangsmate\b/i;

export function extractRecipeMethodSection(body: string): string {
  const normalized = body.replace(/\r\n/g, "\n");
  const marker = normalized.match(METHOD_SECTION_MARKER);
  if (!marker || marker.index === undefined) return "";
  const after = normalized.slice(marker.index + marker[0].length);
  const nextSection = after.search(/\n(?:\*\*[^*]+\*\*|#{1,3}\s+\S+)/);
  return (nextSection >= 0 ? after.slice(0, nextSection) : after).trim();
}

export function extractRecipeMethodSteps(body: string): string[] {
  const section = extractRecipeMethodSection(body);
  if (!section) return [];
  return section
    .split("\n")
    .map((line) => line.trim())
    .map((raw) =>
      raw
        .replace(/^[-*]\s+/, "")
        .replace(/^\d+[\).]?\s+/, "")
        .trim(),
    )
    .filter((line) => {
      if (!line) return false;
      const stripped = line.replace(/^\*\*|\*\*$/g, "").trim();
      return !/^tips\s*:?/i.test(stripped);
    });
}

export function extractRecipeTipsSection(body: string): string {
  const normalized = body.replace(/\r\n/g, "\n");
  const marker = normalized.match(/\*\*Tips:?\*\*|(?:^|\n)Tips\s*:/i);
  if (!marker || marker.index === undefined) return "";
  const after = normalized.slice(marker.index + marker[0].length).trim();
  return after.replace(/^\*\*Tips:?\*\*\s*/i, "").trim();
}

export function buildRecipeBody(input: {
  servings: number;
  ingredients: RecipeIngredientDraft[];
  method: string;
  tips?: string;
}): string {
  const servings = Math.max(1, Math.round(input.servings) || 1);
  const portionWord = servings === 1 ? "porsjon" : "porsjoner";
  const lines = input.ingredients.map(formatRecipeIngredientLine).filter(Boolean);
  const method = input.method.trim();
  const tips = input.tips?.trim() ?? "";

  const parts = [`**Til ${servings} ${portionWord}**`, "", "**Ingredienser**"];
  if (lines.length) {
    parts.push(...lines.map((line) => `- ${line}`));
  } else {
    parts.push("- ");
  }
  parts.push("", "**Slik gjør du**");
  parts.push(method || "1. ");
  if (tips) {
    const tipsBody = tips.replace(/^\*\*Tips:?\*\*\s*/i, "").trim();
    parts.push("", `**Tips:** ${tipsBody}`);
  }
  return parts.join("\n");
}

export function recipePortionsLabel(count: number): string {
  const n = Math.max(1, Math.round(Number.isFinite(count) ? count : 1));
  return n === 1 ? "1 porsjon" : `${n} porsjoner`;
}

/** @deprecated Use recipePortionsLabel — recipes are scaled by portions, not people. */
export function recipePeopleLabel(count: number): string {
  return recipePortionsLabel(count);
}

export function clampRecipeServings(value: number, min = 1, max = 24): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function parseRecipeBaseServings(body: string, override?: number): number {
  return parseRecipeServings(body, override);
}
