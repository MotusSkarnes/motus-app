import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FoodItem } from "../../app/foodBankTypes";
import { FoodLogFormFields } from "./FoodLogFormFields";

const avocado: FoodItem = {
  id: "food-avocado",
  name: "Avokado, rå",
  portionLabel: "1/2 stk",
  portionGrams: 100,
  category: "fettkilder",
  origin: "Test",
  source: "matvaretabell",
  createdBy: "test",
  createdAt: "2024-01-01T00:00:00.000Z",
  unitGrams: { "stk liten": 120, stk: 200, "stk stor": 280, ss: 15 },
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

vi.mock("../../app/useFoodBankItems", () => ({
  useFoodBankItems: () => [avocado],
}));

afterEach(() => {
  cleanup();
});

describe("FoodLogFormFields units", () => {
  it("lets the member pick the same household units as the meal builder", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<FoodLogFormFields onSubmit={onSubmit} />);

    await user.type(screen.getByPlaceholderText("Søk matvare…"), "avokado");
    await user.click(screen.getByRole("option", { name: /Avokado, rå/ }));

    const unitSelect = screen.getByLabelText("Enhet");
    expect(unitSelect).toHaveValue("stk");
    expect(screen.getByRole("option", { name: "ss" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "stk liten" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "stk stor" })).toBeInTheDocument();

    await user.selectOptions(unitSelect, "ss");
    await user.clear(screen.getByLabelText("Mengde"));
    await user.type(screen.getByLabelText("Mengde"), "2");
    await user.click(screen.getByRole("button", { name: "Logg" }));

    expect(onSubmit).toHaveBeenCalledWith({ food: avocado, grams: 30 });
  });
});
