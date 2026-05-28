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

  it("beholder oppdatert imageUrl for eksisterende oppskrift-id", () => {
    const merged = filterRecipeInspirationItems([
      {
        id: "default-recipe-11",
        category: "recipes",
        title: "Kokt egg med grovbrød",
        description: "Oppdatert",
        body: "**Til 1 porsjon**\n\n**Ingredienser**\n- 2 egg\n\n**Slik gjør du**\n1. Kok.",
        tag: "Frokost",
        imageUrl: "https://example.com/new-image.jpg",
      },
    ]);
    const hit = merged.find((row) => row.id === "default-recipe-11");
    expect(hit?.imageUrl).toBe("https://example.com/new-image.jpg");
  });

  it("foretrekker variant med bilde når samme id finnes flere ganger", () => {
    const merged = filterRecipeInspirationItems([
      {
        id: "default-recipe-1",
        category: "recipes",
        title: "Proteinrik frokostbolle",
        description: "Med bilde",
        body: "**Til 1 porsjon**\n\n**Ingredienser**\n- 1 dl gresk yoghurt\n\n**Slik gjør du**\n1. Bland.",
        tag: "Frokost",
        imageUrl: "https://example.com/protein-bowl.jpg",
      },
      {
        id: "default-recipe-1",
        category: "recipes",
        title: "Proteinrik frokostbolle",
        description: "Uten bilde",
        body: "**Til 1 porsjon**\n\n**Ingredienser**\n- 1 dl gresk yoghurt\n\n**Slik gjør du**\n1. Bland.",
        tag: "Frokost",
      },
    ]);
    const hit = merged.find((row) => row.id === "default-recipe-1");
    expect(hit?.imageUrl).toBe("https://example.com/protein-bowl.jpg");
  });
});
