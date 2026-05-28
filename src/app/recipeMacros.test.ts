import { describe, expect, it } from "vitest";
import { DEFAULT_INSPIRATION_RECIPES } from "./defaultInspirationRecipes";
import { buildDefaultFoodBankItems } from "./foodBankSeed";
import {
  applyCanonicalRecipeBodies,
  computeRecipeIngredients,
  computeRecipeMacros,
  extractRecipeIngredientLines,
  parseIngredientLine,
  parseRecipeServings,
} from "./recipeMacros";

const OATMEAL_BODY = `**Til 1 porsjon · ca. 10 min**

**Ingredienser**
- 1 dl havregryn
- 2 dl melk eller havredrikk
- 1 banan
- 1 ss peanøttsmør (helst usaltet)
- 1 ts kanel
- Honning eller lønnesirup (valgfritt)

**Slik gjør du**
1. Kok.`;

describe("recipeMacros", () => {
  const foods = buildDefaultFoodBankItems();

  it("parser porsjoner og ingredienslinjer", () => {
    expect(parseRecipeServings(OATMEAL_BODY)).toBe(1);
    expect(extractRecipeIngredientLines(OATMEAL_BODY).length).toBe(4);
  });

  it("beregner makroer for havregrøt-oppskrift", () => {
    const result = computeRecipeMacros(OATMEAL_BODY, foods);
    expect(result).not.toBeNull();
    expect(result!.matchedCount).toBeGreaterThanOrEqual(4);
    expect(result!.perServing.kcal).toBeGreaterThan(400);
    expect(result!.perServing.protein).toBeGreaterThan(15);
  });

  it("finner ingredienser uten fet skrift på overskrift", () => {
    const body = `Til 1 porsjon

Ingredienser:
- 1 dl havregryn
- 2 dl melk

Slik gjør du
1. Kok.`;
    expect(extractRecipeIngredientLines(body).length).toBe(2);
    expect(computeRecipeMacros(body, foods)).not.toBeNull();
  });

  it("tolerates numbered/non-bullet ingredient lines", () => {
    const body = `Til 1 porsjon

Ingredienser:
1. 150 g gresk yoghurt
2. 40 g havregryn
3. 1 banan

Slik gjør du
1. Bland.`;
    const result = computeRecipeMacros(body, foods);
    expect(result).not.toBeNull();
    expect(result!.matchedCount).toBeGreaterThanOrEqual(3);
  });

  it("parses norwegian word quantity like 'en banan'", () => {
    const body = `**Til 1 porsjon**

**Ingredienser**
- en banan
- 200 g skyr naturell

**Slik gjør du**
1. Bland.`;
    const result = computeRecipeMacros(body, foods);
    expect(result).not.toBeNull();
    expect(result!.matchedCount).toBeGreaterThanOrEqual(2);
  });

  it("deler på antall porsjoner", () => {
    const salmonBody = `**Til 2 porsjoner · ca. 30 min**

**Ingredienser**
- 2 laksefileter (ca. 150 g per stk.)
- 1 stor søtpotet
- 1 lite brokkolihode
- 1 ss olivenolje

**Slik gjør du**
1. Stek.`;

    const result = computeRecipeMacros(salmonBody, foods);
    expect(result?.servings).toBe(2);
    expect(result?.perServing.kcal).toBeGreaterThan(300);
  });

  it("beregner makroer for alle standardoppskrifter", () => {
    const foods = buildDefaultFoodBankItems();
    for (const recipe of DEFAULT_INSPIRATION_RECIPES) {
      const lines = extractRecipeIngredientLines(recipe.body);
      const result = computeRecipeMacros(recipe.body, foods);
      expect(result, recipe.title).not.toBeNull();
      expect(result!.matchedCount, recipe.title).toBeGreaterThanOrEqual(Math.min(lines.length, 3));
      expect(result!.perServing.kcal, recipe.title).toBeGreaterThan(50);
      for (const line of lines) {
        expect(parseIngredientLine(line), line).not.toBeNull();
      }
    }
  });

  it("foretrekker helt egg over Eggewite ved match på 'egg'", () => {
    const recipe = `**Til 1 porsjon**

**Ingredienser**
- 2 egg

**Slik gjør du**
1. Kok.`;
    const orderedFoods = [...buildDefaultFoodBankItems()].sort((a, b) => a.name.localeCompare(b.name, "no"));
    const ingredients = computeRecipeIngredients(recipe, orderedFoods);
    expect(ingredients[0]?.foodName).toBe("Egg");
    expect(Math.round(ingredients[0]?.grams ?? 0)).toBe(100);
  });

  it("bytter inn kanonisk oppskriftstekst når lagret versjon mangler ingredienser", () => {
    const foods = buildDefaultFoodBankItems();
    const canonical = DEFAULT_INSPIRATION_RECIPES[0];
    const patched = applyCanonicalRecipeBodies(
      [{ id: canonical.id, category: "recipes", body: "Kort oppskrift uten ingrediensliste." }],
      undefined,
      foods,
    );
    expect(computeRecipeMacros(patched[0].body, foods)).not.toBeNull();
  });
});
