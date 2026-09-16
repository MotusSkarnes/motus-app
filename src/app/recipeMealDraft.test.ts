import { describe, expect, it } from "vitest";
import { buildDefaultFoodBankItems } from "./foodBankSeed";
import {
  buildRecipeMealDraftItems,
  mealDraftItemsFromRecipeIngredients,
  memberMealSlotIdFromRecipe,
  memberMealSlotIdFromRecipeSlot,
} from "./recipeMealDraft";

const OATMEAL_BODY = `**Til 1 porsjon · ca. 10 min**

**Ingredienser**
- 1 dl havregryn
- 2 dl melk
- 1 banan

**Slik gjør du**
1. Kok.`;

describe("recipeMealDraft", () => {
  const foods = buildDefaultFoodBankItems();

  it("maps recipe meal categories to member log slots", () => {
    expect(memberMealSlotIdFromRecipeSlot("frokost")).toBe("member-frokost");
    expect(memberMealSlotIdFromRecipeSlot("lunsj")).toBe("member-lunsj");
    expect(memberMealSlotIdFromRecipeSlot("middag")).toBe("member-middag");
    expect(memberMealSlotIdFromRecipeSlot("snack")).toBe("member-mellommaltid");
    expect(memberMealSlotIdFromRecipe({ tag: "Frokost", title: "Havregrøt" })).toBe("member-frokost");
  });

  it("turns matched recipe ingredients into an editable meal draft", () => {
    const draft = buildRecipeMealDraftItems(
      {
        id: "oatmeal",
        title: "Havregrøt",
        tag: "Frokost",
        body: OATMEAL_BODY,
        servings: 1,
      },
      foods,
    );
    expect(draft.length).toBeGreaterThanOrEqual(3);
    expect(draft.every((row) => row.grams > 0 && row.source === "food")).toBe(true);
    expect(draft.some((row) => /havre/i.test(row.name))).toBe(true);
  });

  it("skips empty ingredient rows", () => {
    expect(
      mealDraftItemsFromRecipeIngredients([
        {
          key: "ing-0",
          sourceLine: "0 g",
          searchText: "x",
          displayAmount: "0 g",
          foodId: "f1",
          foodName: "Egg",
          category: "proteinkilder",
          grams: 0,
          macros: { kcal: 0, protein: 0, carbs: 0, fat: 0 },
          nutritionPer100g: {
            kcal: 140,
            protein: 12,
            carbs: 1,
            fat: 10,
            fiber: 0,
            sugar: 0,
            saturatedFat: 3,
            sodium: 0,
          },
        },
      ]),
    ).toEqual([]);
  });
});
