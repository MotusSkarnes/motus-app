import { describe, expect, it } from "vitest";
import { resolveNutritionReferenceContext } from "./personalizedNutritionReferences";

describe("resolveNutritionReferenceContext", () => {
  it("bruker høyere jern og fiber for voksne kvinner", () => {
    const ctx = resolveNutritionReferenceContext("15.03.1990", "female");
    expect(ctx.isPersonalized).toBe(true);
    expect(ctx.micronutrientDaily.iron).toBe(15);
    expect(ctx.otherDaily.fiber).toBe(25);
    expect(ctx.otherDaily.waterLiters).toBe(2);
  });

  it("bruker lavere jern og høyere fiber for voksne menn", () => {
    const ctx = resolveNutritionReferenceContext("15.03.1990", "male");
    expect(ctx.micronutrientDaily.iron).toBe(9);
    expect(ctx.otherDaily.fiber).toBe(35);
    expect(ctx.otherDaily.waterLiters).toBe(2.5);
    expect(ctx.otherDaily.sodium).toBe(2300);
  });

  it("markerer manglende profil", () => {
    const ctx = resolveNutritionReferenceContext("", "");
    expect(ctx.isPersonalized).toBe(false);
    expect(ctx.missingFields).toEqual(["age", "gender"]);
  });
});
