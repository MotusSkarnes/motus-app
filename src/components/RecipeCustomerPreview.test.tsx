import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import type { FoodItem } from "../app/foodBankTypes";
import type { RecipeIngredientDraft } from "../app/recipeBody";
import { RecipeCustomerPreview } from "./RecipeCustomerPreview";

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

function PreviewHarness() {
  const [ingredients, setIngredients] = useState<RecipeIngredientDraft[]>([
    { id: "ing-1", quantity: "1", unit: "stk", name: "Avokado", foodId: "avocado-1" },
  ]);
  return (
    <RecipeCustomerPreview
      ingredients={ingredients}
      servings={1}
      body={"**Slik gjør du**\n1. Mos avokadoen."}
      foodItems={[avocado()]}
      onNameChange={(id, name) => {
        setIngredients((current) => current.map((row) => (row.id === id ? { ...row, name } : row)));
      }}
    />
  );
}

describe("RecipeCustomerPreview", () => {
  it("beholder ingredienslinja når kundenavnet tømmes", async () => {
    const user = userEvent.setup();
    render(<PreviewHarness />);

    const input = screen.getByLabelText(/Navn kunden ser/);
    await user.clear(input);

    expect(screen.getByRole("region", { name: "Slik ser kunden det" })).toBeInTheDocument();
    expect(screen.getByLabelText(/Navn kunden ser/)).toHaveValue("");
    expect(screen.getByText("1 stk")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Avokado")).toBeInTheDocument();
  });
});
