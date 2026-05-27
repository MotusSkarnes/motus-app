import { describe, expect, it } from "vitest";
import { filterRecipeInspirationItems } from "./inspirationRecipeItems";

describe("filterRecipeInspirationItems", () => {
  it("lar lagrede oppskrifter overstyre standardoppskrifter med samme id", () => {
    const merged = filterRecipeInspirationItems([
      {
        id: "default-recipe-1",
        category: "recipes",
        title: "Min tilpassede frokost",
        description: "Endret",
        body: "**Til 1 porsjon**\n\n**Ingredienser**\n- 1 dl lettmelk\n\n**Slik gjør du**\n1. Bland.",
        tag: "Frokost",
      },
    ]);
    const hit = merged.find((row) => row.id === "default-recipe-1");
    expect(hit?.title).toBe("Min tilpassede frokost");
    expect(hit?.description).toBe("Endret");
  });
});
