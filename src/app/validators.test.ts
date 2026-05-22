import { describe, expect, it } from "vitest";
import { isLikelyValidBirthDate, normalizeBirthDate } from "./validators";

describe("birth date validation", () => {
  it("accepts real calendar dates in dd.mm.yyyy format", () => {
    expect(isLikelyValidBirthDate("29.02.2000")).toBe(true);
    expect(isLikelyValidBirthDate("31.12.2000")).toBe(true);
  });

  it("rejects calendar dates that do not exist", () => {
    expect(isLikelyValidBirthDate("31.02.2000")).toBe(false);
    expect(isLikelyValidBirthDate("29.02.2001")).toBe(false);
    expect(isLikelyValidBirthDate("31.04.2000")).toBe(false);
  });

  it("normalizes valid ISO dates without rolling impossible dates forward", () => {
    expect(normalizeBirthDate("2000-02-29")).toBe("29.02.2000");
    expect(normalizeBirthDate("2000-02-31")).toBe("2000-02-31");
    expect(isLikelyValidBirthDate("2000-02-31")).toBe(false);
  });
});
