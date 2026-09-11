import { describe, expect, it } from "vitest";
import { foodSourceFamilyKey } from "./foodSourceFamily";

describe("foodSourceFamilyKey", () => {
  it("groups liver from different animals as one family", () => {
    expect(foodSourceFamilyKey("Lever, kylling, rå")).toBe("lever");
    expect(foodSourceFamilyKey("Lever, svin, rå")).toBe("lever");
    expect(foodSourceFamilyKey("Lever, storfe, rå")).toBe("lever");
    expect(foodSourceFamilyKey("Svinlever")).toBe("lever");
    expect(foodSourceFamilyKey("Torskelever")).toBe("lever");
  });

  it("does not group liver products with liver, but collapses pâté variants", () => {
    expect(foodSourceFamilyKey("Leverpostei, fersk")).not.toBe("lever");
    expect(foodSourceFamilyKey("Leverpostei, fersk")).toBe("leverpostei");
    expect(foodSourceFamilyKey("Leverpostei, grov, dansk")).toBe("leverpostei");
    expect(foodSourceFamilyKey("Leverpostei, hermetisk")).toBe("leverpostei");
    expect(foodSourceFamilyKey("Rognleverpostei")).toBe("leverpostei");
    expect(foodSourceFamilyKey("Torskelever, tran")).not.toBe("lever");
    expect(foodSourceFamilyKey("Torskelever, tran")).not.toBe("leverpostei");
  });

  it("collapses the same vegetable across color and cooking", () => {
    expect(foodSourceFamilyKey("Paprika, rød, rå")).toBe("paprika");
    expect(foodSourceFamilyKey("Paprika, grønn, kokt")).toBe("paprika");
    expect(foodSourceFamilyKey("Tomat, norsk, rå")).toBe(foodSourceFamilyKey("Tomat, kokt"));
  });

  it("keeps distinct cuts and cheese types apart", () => {
    expect(foodSourceFamilyKey("Kylling, bryst, uten skinn, rå")).not.toBe(
      foodSourceFamilyKey("Kylling, lår, rå"),
    );
    expect(foodSourceFamilyKey("Ost, norvegia")).not.toBe(foodSourceFamilyKey("Ost, jarlsberg"));
    expect(foodSourceFamilyKey("Hjerte, rå")).not.toBe(foodSourceFamilyKey("Hjertesalat, rå"));
  });
});
