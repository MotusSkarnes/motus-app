import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import type { FoodItem } from "../app/foodBankTypes";
import { withRegisteredUnitGrams } from "../app/foodUnitGrams";
import { RecipeIngredientEditor } from "./RecipeIngredientEditor";

afterEach(() => {
  cleanup();
});

function avocado(): FoodItem {
  return {
    id: "avocado-1",
    name: "Avokado",
    category: "frukt-baer",
    origin: "Test",
    source: "matvaretabell",
    createdBy: "test",
    createdAt: "2024-01-01T00:00:00.000Z",
    portionLabel: "100 g",
    portionGrams: 100,
    unitGrams: { "stk liten": 130, "stk stor": 220 },
    nutritionPer100g: {
      kcal: 160,
      protein: 2,
      carbs: 9,
      fat: 15,
      fiber: 7,
      sugar: 1,
      saturatedFat: 2,
      sodium: 7,
    },
  };
}

function optionValues(select: HTMLElement): string[] {
  return [...select.querySelectorAll("option")].map((option) => option.value);
}

function EditorHarness() {
  const [foodItems, setFoodItems] = useState<FoodItem[]>([avocado()]);
  const [ingredients, setIngredients] = useState([]);

  return (
    <RecipeIngredientEditor
      ingredients={ingredients}
      foodItems={foodItems}
      onChange={setIngredients}
      onRegisterUnitGrams={(foodId, unit, gramsPerUnit) => {
        setFoodItems((current) =>
          current.map((item) => (item.id === foodId ? withRegisteredUnitGrams(item, unit, gramsPerUnit) : item)),
        );
      }}
    />
  );
}

describe("RecipeIngredientEditor", () => {
  it("viser bare enheter med vekt, og vekt-knappen åpner enheter uten vekt", async () => {
    const user = userEvent.setup();
    render(<EditorHarness />);

    await user.type(screen.getByLabelText("Søk matvare"), "avokado");
    await user.click(screen.getByRole("button", { name: /Avokado/ }));

    const unitSelect = screen.getByLabelText("Enhet");
    expect(optionValues(unitSelect)).toEqual(["g", "kg", "stk liten", "stk", "stk stor"]);

    await user.click(screen.getByRole("button", { name: /enheter uten vekt/i }));

    const missingSelect = screen.getByLabelText("Enhet uten vekt for Avokado");
    expect(optionValues(missingSelect)).toContain("ss");
    expect(optionValues(missingSelect)).not.toContain("g");
    expect(optionValues(missingSelect)).not.toContain("stk liten");

    await user.selectOptions(missingSelect, "ss");
    await user.type(screen.getByLabelText("Gram per 1 ss Avokado"), "15");
    await user.click(screen.getByRole("button", { name: "Lagre vekt" }));

    expect(optionValues(screen.getByLabelText("Enhet"))).toEqual(["g", "kg", "ss", "stk liten", "stk", "stk stor"]);
    expect(screen.queryByLabelText("Enhet uten vekt for Avokado")).toBeNull();

    await user.click(screen.getByRole("button", { name: /enheter uten vekt/i }));
    expect(optionValues(screen.getByLabelText("Enhet uten vekt for Avokado"))).not.toContain("ss");
  });
});
