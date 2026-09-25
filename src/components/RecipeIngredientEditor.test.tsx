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

function LinseedHarness() {
  const [ingredients, setIngredients] = useState([]);
  const linseed: FoodItem = {
    ...avocado(),
    id: "linseed-1",
    name: "Linfrø, knuste",
    unitGrams: { ss: 8, ts: 3, dl: 60 },
  };

  return (
    <RecipeIngredientEditor
      ingredients={ingredients}
      foodItems={[linseed]}
      onChange={setIngredients}
      onRegisterUnitGrams={() => undefined}
    />
  );
}

describe("RecipeIngredientEditor", () => {
  it("viser bare søk i matvarebanken, ikke et separat fritekstfelt", () => {
    render(<EditorHarness />);

    expect(screen.getByLabelText("Søk matvare")).toBeInTheDocument();
    expect(screen.queryByLabelText("Egen ingrediens")).toBeNull();
  });

  it("viser bare enheter med vekt, og vekt-knappen åpner enheter uten vekt", async () => {
    const user = userEvent.setup();
    render(<EditorHarness />);

    await user.type(screen.getByLabelText("Søk matvare"), "avokado");
    await user.click(screen.getByRole("button", { name: /Avokado/ }));

    const unitSelect = screen.getByLabelText("Enhet");
    expect(optionValues(unitSelect)).toEqual(["g", "kg", "stk liten", "stk", "stk stor"]);

    await user.click(screen.getByRole("button", { name: /enhetsvekt/i }));

    const missingSelect = screen.getByLabelText("Enhet for vekt på Avokado");
    expect(optionValues(missingSelect)).toContain("ss");
    expect(optionValues(missingSelect)).not.toContain("g");
    expect(optionValues(missingSelect)).not.toContain("stk liten");

    await user.selectOptions(missingSelect, "ss");
    await user.type(screen.getByLabelText("Gram per 1 ss Avokado"), "15");
    await user.click(screen.getByRole("button", { name: "Lagre vekt" }));

    expect(optionValues(screen.getByLabelText("Enhet"))).toEqual(["g", "kg", "ss", "stk liten", "stk", "stk stor"]);
    expect(screen.queryByLabelText("Enhet for vekt på Avokado")).toBeNull();

    await user.click(screen.getByRole("button", { name: /enhetsvekt/i }));
    expect(screen.getByLabelText("Enhet for vekt på Avokado")).toHaveValue("ss");
    expect(screen.getByLabelText("Gram per 1 ss Avokado")).toHaveValue("15");
  });

  it("åpner valgt ts med eksisterende vekt for knuste linfrø", async () => {
    const user = userEvent.setup();
    render(<LinseedHarness />);

    await user.type(screen.getByLabelText("Søk matvare"), "linfrø");
    await user.click(screen.getByRole("button", { name: "Linfrø, knuste" }));
    await user.selectOptions(screen.getByLabelText("Enhet"), "ts");
    await user.click(screen.getByRole("button", { name: /enhetsvekt/i }));

    expect(screen.getByLabelText("Enhet for vekt på Linfrø, knuste")).toHaveValue("ts");
    expect(screen.getByLabelText("Gram per 1 ts Linfrø, knuste")).toHaveValue("3");
  });
});
