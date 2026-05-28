import { describe, expect, it } from "vitest";
import { extractRecipeMethodSteps, formatMealEntryAmount } from "./MemberMealPlanDashboard";

describe("MemberMealPlanDashboard helpers", () => {
  it("formats recipe amount as portions", () => {
    expect(formatMealEntryAmount("inspo-recipe-abc", 100)).toBe("1 porsjon");
    expect(formatMealEntryAmount("inspo-recipe-abc", 150)).toBe("1.5 porsjoner");
  });

  it("extracts method steps after 'Slik gjør du'", () => {
    const body = `**Til 1 porsjon**\n\n**Ingredienser**\n- 100 g skyr\n\n**Slik gjør du**\n1. Bland i bolle.\n2. Topp med bær.\n\n**Tips:** Server kald.`;
    expect(extractRecipeMethodSteps(body)).toEqual(["Bland i bolle.", "Topp med bær."]);
  });
});
