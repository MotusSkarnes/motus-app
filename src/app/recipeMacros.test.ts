import { describe, expect, it } from "vitest";
import { buildDefaultFoodBankItems } from "./foodBankSeed";
import {
  computeRecipeMacros,
  extractRecipeIngredientLines,
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
    expect(extractRecipeIngredientLines(OATMEAL_BODY).length).toBe(5);
  });

  it("beregner makroer for havregrøt-oppskrift", () => {
    const result = computeRecipeMacros(OATMEAL_BODY, foods);
    expect(result).not.toBeNull();
    expect(result!.matchedCount).toBeGreaterThanOrEqual(4);
    expect(result!.perServing.kcal).toBeGreaterThan(400);
    expect(result!.perServing.protein).toBeGreaterThan(15);
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
});
