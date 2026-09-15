import { describe, expect, it } from "vitest";
import {
  parseRecipeMealSlots,
  recipeBelongsToMealSlot,
  recipeMealSlotFor,
  recipeMealSlotsFor,
  resolveRecipeMealSlot,
} from "./recipeMealCategory";

describe("resolveRecipeMealSlot", () => {
  it("leser måltid fra tag", () => {
    expect(resolveRecipeMealSlot("10 min · Frokost", "Havregrøt", "")).toBe("frokost");
    expect(resolveRecipeMealSlot("15 min · Lunsj", "Wrap", "")).toBe("lunsj");
    expect(resolveRecipeMealSlot("30 min · Middag", "Laks", "")).toBe("middag");
    expect(resolveRecipeMealSlot("Snack", "Proteinbar", "")).toBe("snack");
  });

  it("gjetter frokost fra tittel når tag mangler måltid", () => {
    expect(resolveRecipeMealSlot("15 min", "Proteinrik frokostbolle", "")).toBe("frokost");
  });

  it("gjetter frokost fra cottage cheese, kesam og bær", () => {
    expect(resolveRecipeMealSlot("Oppskrift", "Cottage cheese, kesam og bær", "")).toBe("frokost");
  });
});

describe("recipeMealSlotsFor", () => {
  it("bruker lagrede kategorier foran gjetting", () => {
    expect(
      recipeMealSlotsFor({
        mealSlots: ["lunsj", "frokost"],
        tag: "Oppskrift",
        title: "Cottage cheese, kesam og bær",
      }),
    ).toEqual(["frokost", "lunsj"]);
  });

  it("beholder gammel enkelt-kategori", () => {
    expect(
      recipeMealSlotFor({
        mealSlot: "snack",
        tag: "Oppskrift",
        title: "Cottage cheese, kesam og bær",
      }),
    ).toBe("snack");
  });

  it("sjekker om oppskriften ligger i flere faner", () => {
    const item = {
      mealSlots: ["frokost", "lunsj"] as ("frokost" | "lunsj")[],
      tag: "Oppskrift",
      title: "Cottage cheese",
    };
    expect(recipeBelongsToMealSlot(item, "frokost")).toBe(true);
    expect(recipeBelongsToMealSlot(item, "lunsj")).toBe(true);
    expect(recipeBelongsToMealSlot(item, "middag")).toBe(false);
    expect(recipeMealSlotFor(item, "lunsj")).toBe("lunsj");
  });

  it("parser både liste og gammel enkeltverdi", () => {
    expect(parseRecipeMealSlots(["lunsj", "frokost", "ukjent"])).toEqual(["frokost", "lunsj"]);
    expect(parseRecipeMealSlots(undefined, "snack")).toEqual(["snack"]);
  });
});
