import { describe, expect, it } from "vitest";
import { resolveNutritionReferenceContext } from "./personalizedNutritionReferences";

describe("resolveNutritionReferenceContext", () => {
  it("bruker høyere jern for voksne kvinner", () => {
    const ctx = resolveNutritionReferenceContext("15.03.1990", "female");
    expect(ctx.isPersonalized).toBe(true);
    expect(ctx.micronutrientDaily.iron).toBe(15);
  });

  it("bruker lavere jern for voksne menn", () => {
    const ctx = resolveNutritionReferenceContext("15.03.1990", "male");
    expect(ctx.micronutrientDaily.iron).toBe(9);
  });

  it("markerer manglende profil", () => {
    const ctx = resolveNutritionReferenceContext("", "");
    expect(ctx.isPersonalized).toBe(false);
    expect(ctx.missingFields).toEqual(["age", "gender"]);
  });
});
