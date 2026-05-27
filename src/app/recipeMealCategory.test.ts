import { describe, expect, it } from "vitest";
import { resolveRecipeMealSlot } from "./recipeMealCategory";

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
});
