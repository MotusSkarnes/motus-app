import { describe, expect, it } from "vitest";
import {
  highestMicronutrientDaily,
  resolveMealPlanNutritionReferenceContext,
  resolveNutritionReferenceContext,
  resolveNutritionReferenceFromAge,
} from "./personalizedNutritionReferences";

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

  it("tar alder direkte uten fødselsdato", () => {
    const ctx = resolveNutritionReferenceFromAge(35, "female");
    expect(ctx.isPersonalized).toBe(true);
    expect(ctx.ageYears).toBe(35);
    expect(ctx.micronutrientDaily.iron).toBe(15);
  });

  it("bruker høyeste anbefaling på tvers av alder og kjønn", () => {
    const daily = highestMicronutrientDaily();
    expect(daily.iron).toBe(15);
    expect(daily.zinc).toBe(11);
    expect(daily.vitaminD).toBe(20);
    expect(daily.calcium).toBe(900);
  });

  it("velger høyeste anbefaling for mal uten klientprofil", () => {
    const ctx = resolveMealPlanNutritionReferenceContext({});
    expect(ctx.profileLabel).toBe("høyeste anbefaling");
    expect(ctx.micronutrientDaily.iron).toBe(15);
  });

  it("respekterer lagret alder og kjønn", () => {
    const ctx = resolveMealPlanNutritionReferenceContext({
      stored: { mode: "custom", ageYears: 16, gender: "female" },
    });
    expect(ctx.profileLabel).toBe("Kvinne, 16 år");
    expect(ctx.micronutrientDaily.iron).toBe(15);
    expect(ctx.micronutrientDaily.calcium).toBe(900);
  });
});
