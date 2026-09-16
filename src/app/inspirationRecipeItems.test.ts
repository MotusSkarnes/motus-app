import { describe, expect, it } from "vitest";
import { filterRecipeInspirationItems, resolveInspirationFeedForWrite } from "./inspirationRecipeItems";

describe("filterRecipeInspirationItems", () => {
  it("lar lagrede oppskrifter overstyre standardoppskrifter med samme id", () => {
    const merged = filterRecipeInspirationItems(
      [
      {
        id: "default-recipe-1",
        category: "recipes",
        title: "Min tilpassede frokost",
        description: "Endret",
        body: "**Til 1 porsjon**\n\n**Ingredienser**\n- 1 dl lettmelk\n\n**Slik gjør du**\n1. Bland.",
        tag: "Frokost",
      },
      ],
      { suppressedIds: [] },
    );
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

  it("skjuler slettede standardoppskrifter", () => {
    const merged = filterRecipeInspirationItems(
      [
        {
          id: "custom-recipe-1",
          category: "recipes",
          title: "Cottage cheese og bær",
          description: "Egen",
          body: "**Til 1 porsjon**\n\n**Ingredienser**\n- 150 g cottage cheese\n\n**Slik gjør du**\n1. Bland.",
          tag: "Frokost",
        },
      ],
      { suppressedIds: ["default-recipe-1", "custom-recipe-1"] },
    );
    expect(merged.some((row) => row.id === "default-recipe-1")).toBe(false);
    expect(merged.some((row) => row.id === "custom-recipe-1")).toBe(false);
  });
});

describe("resolveInspirationFeedForWrite", () => {
  const article = { id: "news-1", category: "news", title: "Tips" };
  const recipe = { id: "recipe-1", category: "recipes", title: "Havregrøt" };

  it("uses a successfully fetched remote snapshot, including an empty one", () => {
    expect(resolveInspirationFeedForWrite([], [{ id: "stale" }], [article])).toEqual([]);
    expect(resolveInspirationFeedForWrite([article, recipe], null, [])).toEqual([article, recipe]);
  });

  it("falls back to a non-empty local or caller snapshot when remote fetch misses", () => {
    expect(resolveInspirationFeedForWrite(null, [article], [])).toEqual([article]);
    expect(resolveInspirationFeedForWrite(null, null, [recipe])).toEqual([recipe]);
  });

  it("refuses to persist when no feed was loaded, so a recipe delete cannot wipe Utforsk", () => {
    expect(resolveInspirationFeedForWrite(null, null, [])).toBeNull();
    expect(resolveInspirationFeedForWrite(undefined, null, [])).toBeNull();
    expect(resolveInspirationFeedForWrite(null, [], [])).toBeNull();
  });
});
