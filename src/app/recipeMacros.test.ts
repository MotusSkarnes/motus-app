import { describe, expect, it } from "vitest";
import { DEFAULT_INSPIRATION_RECIPES } from "./defaultInspirationRecipes";
import { buildDefaultFoodBankItems } from "./foodBankSeed";
import {
  applyCanonicalRecipeBodies,
  computeRecipeIngredients,
  computeRecipeMacros,
  extractRecipeIngredientLines,
  normalizeRecipeIngredientFoodOverrides,
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
    expect(result!.perServingMicronutrients.calcium).toBeGreaterThanOrEqual(0);
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

  it("lar eget porsjonsfelt overstyre tekst i oppskriften", () => {
    const body = `**Til 1 porsjon**

**Ingredienser**
- 400 g linser

**Slik gjÃ¸r du**
1. Kok.`;
    const result = computeRecipeMacros(body, foods, { servings: 4 });
    expect(result?.servings).toBe(4);
    expect(result?.matchedCount).toBe(1);
  });

  it("matcher linser og kokosmelk uten Ã¥ velge tomat eller bolle", () => {
    const body = `**Til 4 porsjoner**

**Ingredienser**
- 400 g linser
- 2 dl kokosmelk

**Slik gjÃ¸r du**
1. Kok.`;
    const ingredients = computeRecipeIngredients(body, foods);
    const names = ingredients.map((row) => row.foodName.toLowerCase()).join(" | ");
    expect(names).toContain("linser");
    expect(names).toContain("kokosmelk");
    expect(names).not.toContain("tomat");
    expect(names).not.toContain("bolle");
  });

  it("bruker trygg linse-fallback selv nÃ¥r matvarebanken mangler linser", () => {
    const tomatoOnlyBank = foods.filter((food) => food.name.toLowerCase().includes("tomat"));
    const body = `**Til 4 porsjoner**

**Ingredienser**
- 400 g linser

**Slik gjÃ¸r du**
1. Kok.`;
    const ingredients = computeRecipeIngredients(body, tomatoOnlyBank);
    expect(ingredients).toHaveLength(1);
    expect(ingredients[0]?.foodName.toLowerCase()).toContain("linser");
    expect(ingredients[0]?.foodName.toLowerCase()).not.toContain("tomat");
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

  it("matcher soyafarse i matvarebanken", () => {
    const soyafarse = foods.find((item) => item.name === "Soyafarse");
    expect(soyafarse).toBeTruthy();
    const body = `**Ingredienser**\n- 200 g soyafarse`;
    const ingredients = computeRecipeIngredients(body, foods);
    expect(ingredients[0]?.foodName).toBe("Soyafarse");
    expect(ingredients[0]?.grams).toBe(200);
  });

  it("bruker manuelle matvarekoblinger for oppskriftsingredienser", () => {
    const body = `**Ingredienser**\n- 200 g kjøttdeig`;
    const auto = computeRecipeIngredients(body, foods)[0];
    expect(auto?.foodName).toBe("Karbonadedeig mager");
    const soyafarse = foods.find((item) => item.name === "Soyafarse");
    expect(soyafarse).toBeTruthy();
    const overridden = computeRecipeIngredients(body, foods, { [auto!.key]: soyafarse!.id });
    expect(overridden[0]?.foodName).toBe("Soyafarse");
    expect(overridden[0]?.grams).toBe(200);
  });

  it("beholder manuelle matvarekoblinger når en ingrediens settes inn før raden", () => {
    const originalBody = `**Ingredienser**\n- 200 g kjøttdeig`;
    const editedBody = `**Ingredienser**\n- 1 løk\n- 200 g kjøttdeig`;
    const originalIngredient = computeRecipeIngredients(originalBody, foods)[0];
    const soyafarse = foods.find((item) => item.name === "Soyafarse");
    expect(originalIngredient).toBeTruthy();
    expect(soyafarse).toBeTruthy();

    const overrides = { [originalIngredient!.key]: soyafarse!.id };
    const normalized = normalizeRecipeIngredientFoodOverrides(editedBody, foods, overrides);
    const ingredients = computeRecipeIngredients(editedBody, foods, normalized);

    expect(ingredients.find((row) => row.searchText === "løk")?.foodName).not.toBe("Soyafarse");
    expect(ingredients.find((row) => row.searchText === "kjøttdeig")?.foodName).toBe("Soyafarse");
  });
});
