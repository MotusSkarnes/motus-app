import { describe, expect, it } from "vitest";
import {
  classifyMicronutrientStatus,
  resolveMicronutrientBounds,
  resolveMicronutrientStatus,
} from "./micronutrientReferenceRanges";
import { resolveNutritionReferenceContext } from "./personalizedNutritionReferences";

describe("micronutrientReferenceRanges", () => {
  const adultFemale = resolveNutritionReferenceContext("1990-06-15", "female");

  it("classifies below AR as low", () => {
    const bounds = resolveMicronutrientBounds("iron", adultFemale);
    expect(classifyMicronutrientStatus(bounds.lower - 1, bounds)).toBe("low");
  });

  it("classifies between AR and RI as below_recommended", () => {
    const bounds = resolveMicronutrientBounds("iron", adultFemale);
    expect(classifyMicronutrientStatus((bounds.lower + bounds.recommended) / 2, bounds)).toBe("below_recommended");
  });

  it("classifies at RI as adequate", () => {
    const bounds = resolveMicronutrientBounds("iron", adultFemale);
    expect(classifyMicronutrientStatus(bounds.recommended, bounds)).toBe("adequate");
  });

  it("classifies above UL as high", () => {
    const bounds = resolveMicronutrientBounds("iron", adultFemale);
    expect(bounds.upper).toBe(60);
    expect(classifyMicronutrientStatus(61, bounds)).toBe("high");
  });

  it("classifies near UL as near_upper", () => {
    const bounds = resolveMicronutrientBounds("zinc", adultFemale);
    expect(bounds.upper).toBe(25);
    expect(classifyMicronutrientStatus(22, bounds)).toBe("near_upper");
  });

  it("returns status meta with label", () => {
    const meta = resolveMicronutrientStatus(5, "iron", adultFemale);
    expect(meta.code).toBe("low");
    expect(meta.tone).toBe("danger");
  });
});
