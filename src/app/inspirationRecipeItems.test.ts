import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  filterRecipeInspirationItems,
  persistedRecipeAvailability,
  resolveInspirationFeedForWrite,
  setInspirationRecipeAvailability,
  type InspirationRecipeItem,
} from "./inspirationRecipeItems";
import { fetchInspirationItemsForHub, loadInspirationItemsFromLocalStorage, persistInspirationItems } from "./inspirationStorage";

vi.mock("./inspirationStorage", async () => {
  const actual = await vi.importActual<typeof import("./inspirationStorage")>("./inspirationStorage");
  return {
    ...actual,
    fetchInspirationItemsForHub: vi.fn(),
    loadInspirationItemsFromLocalStorage: vi.fn(),
    persistInspirationItems: vi.fn(),
  };
});

const fetchFeed = vi.mocked(fetchInspirationItemsForHub);
const loadLocalFeed = vi.mocked(loadInspirationItemsFromLocalStorage);
const persistFeed = vi.mocked(persistInspirationItems);

describe("filterRecipeInspirationItems", () => {
  it("har kundetilgang uten matplan avslått som standard", () => {
    const merged = filterRecipeInspirationItems([], { suppressedIds: [] });
    expect(merged.length).toBeGreaterThan(0);
    expect(merged.every((row) => row.availableWithoutMealPlan === false)).toBe(true);
  });

  it("beholder eksplisitt kundetilgang uten matplan", () => {
    const merged = filterRecipeInspirationItems(
      [{
        id: "customer-visible-recipe",
        category: "recipes",
        title: "Synlig måltid",
        description: "Test",
        body: "Test",
        tag: "Frokost",
        availableWithoutMealPlan: true,
      }],
      { suppressedIds: [] },
    );
    expect(merged.find((row) => row.id === "customer-visible-recipe")?.availableWithoutMealPlan).toBe(true);
  });

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

const meal: InspirationRecipeItem = {
  id: "recipe-1",
  title: "Havregrøt",
  description: "Frokost",
  body: "**Til 1 porsjon**",
  tag: "Frokost",
};

describe("resolveInspirationFeedForWrite", () => {
  const article = { id: "news-1", category: "news", title: "Tips" };

  it("uses a fetched snapshot, including an empty one", () => {
    expect(resolveInspirationFeedForWrite([], [article])).toEqual([]);
    expect(resolveInspirationFeedForWrite([article, meal], null)).toEqual([article, meal]);
  });

  it("uses a non-empty local feed only when the fetch missed", () => {
    expect(resolveInspirationFeedForWrite(null, [article])).toEqual([article]);
  });

  it("refuses to write when no feed was loaded", () => {
    expect(resolveInspirationFeedForWrite(null, null)).toBeNull();
    expect(resolveInspirationFeedForWrite(undefined, [])).toBeNull();
  });
});

describe("setInspirationRecipeAvailability", () => {
  const article = { id: "news-1", category: "news", title: "Ukens tips", kind: "article" };
  const periodPlan = { id: "plan-1", category: "training", kind: "periodPlan", title: "10 km" };

  beforeEach(() => {
    fetchFeed.mockReset();
    loadLocalFeed.mockReset();
    persistFeed.mockReset();
    persistFeed.mockResolvedValue({ ok: true, cloudSynced: true });
  });

  it("does not persist when the shared feed failed to load", async () => {
    fetchFeed.mockResolvedValue(null);
    loadLocalFeed.mockReturnValue(null);

    const result = await setInspirationRecipeAvailability(meal, true);

    expect(result).toEqual({ ok: false, error: "Kunne ikke laste måltidene. Prøv igjen." });
    expect(persistFeed).not.toHaveBeenCalled();
  });

  it("updates one meal and keeps the rest of the feed", async () => {
    fetchFeed.mockResolvedValue([article, periodPlan, { ...meal, category: "recipes", availableWithoutMealPlan: false }]);
    loadLocalFeed.mockReturnValue(null);

    const result = await setInspirationRecipeAvailability(meal, true);

    expect(result).toEqual({ ok: true, cloudSynced: true });
    expect(persistFeed).toHaveBeenCalledTimes(1);
    const saved = persistFeed.mock.calls[0][0] as Array<Record<string, unknown>>;
    expect(saved).toHaveLength(3);
    expect(saved[0]).toEqual(article);
    expect(saved[1]).toEqual(periodPlan);
    expect(saved[2]).toMatchObject({ id: "recipe-1", availableWithoutMealPlan: true, body: meal.body });
  });

  it("appends a built-in meal onto a loaded feed instead of replacing it", async () => {
    fetchFeed.mockResolvedValue([article, periodPlan]);
    loadLocalFeed.mockReturnValue(null);

    await setInspirationRecipeAvailability(meal, true);

    const saved = persistFeed.mock.calls[0][0] as Array<Record<string, unknown>>;
    expect(saved.map((item) => item.id)).toEqual(["news-1", "plan-1", "recipe-1"]);
    expect(saved[2]).toMatchObject({ availableWithoutMealPlan: true, category: "recipes" });
  });

  it("can update a non-empty local feed when the fetch misses", async () => {
    fetchFeed.mockResolvedValue(null);
    loadLocalFeed.mockReturnValue([article, { ...meal, category: "recipes" }]);

    await setInspirationRecipeAvailability(meal, true);

    const saved = persistFeed.mock.calls[0][0] as Array<Record<string, unknown>>;
    expect(saved.map((item) => item.id)).toEqual(["news-1", "recipe-1"]);
    expect(saved[1]).toMatchObject({ availableWithoutMealPlan: true });
  });
});

describe("persistedRecipeAvailability", () => {
  it("keeps access for members without a meal plan when the meal is edited", () => {
    expect(persistedRecipeAvailability({ availableWithoutMealPlan: true }, false)).toEqual({
      availableWithoutMealPlan: true,
    });
  });

  it("does not copy access onto a duplicate or a meal that was not shared", () => {
    expect(persistedRecipeAvailability({ availableWithoutMealPlan: true }, true)).toEqual({});
    expect(persistedRecipeAvailability({ availableWithoutMealPlan: false }, false)).toEqual({});
    expect(persistedRecipeAvailability(null, false)).toEqual({});
  });
});
