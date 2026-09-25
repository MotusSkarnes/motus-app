import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TrainerRecipeComposer } from "./TrainerRecipeComposer";

const foods = vi.hoisted(() =>
  [
    ["pear", "Pære, norsk, rå", "🍐", { stk: 170 }],
    ["banana", "Banan, rå", "🍌", { stk: 120 }],
    ["kiwi", "Kiwi, rå", "🥝", { stk: 75 }],
    ["celery", "Stangselleri, norsk, rå", "🥬", { stk: 380, stilk: 33, dl: 50 }],
  ].map(([id, name, imageEmoji, unitGrams]) => ({
    id,
    name,
    imageEmoji,
    unitGrams,
    category: "frukt-baer",
    origin: "Test",
    source: "matvaretabell",
    createdBy: "test",
    createdAt: "2026-01-01",
    portionLabel: "100 g",
    portionGrams: 100,
    nutritionPer100g: { kcal: 50, protein: 1, carbs: 10, fat: 0.2, fiber: 2, sugar: 8, saturatedFat: 0, sodium: 1 },
  })),
);

vi.mock("../../app/useFoodBankItems", () => ({ useFoodBankItems: () => foods }));

afterEach(cleanup);

describe("TrainerRecipeComposer stangselleri", () => {
  it("legger til pære, banan, kiwi og én stilk stangselleri", async () => {
    const user = userEvent.setup();
    render(
      <TrainerRecipeComposer open members={[]} existingItems={[]} onClose={vi.fn()} onSaved={vi.fn()} />,
    );

    const addFood = async (query: string, exactName: string, unit: string) => {
      await user.type(screen.getByLabelText("Søk matvare"), query);
      const results = screen.getByRole("listbox", { name: "Matvarer" });
      await user.click(within(results).getByRole("button", { name: exactName }));
      await user.clear(screen.getByLabelText("Mengde"));
      await user.type(screen.getByLabelText("Mengde"), "1");
      await user.selectOptions(screen.getByLabelText("Enhet"), unit);
      await user.click(screen.getByRole("button", { name: "Legg til" }));
    };

    await addFood("pære norsk", "Pære, norsk, rå", "stk");
    await addFood("banan rå", "Banan, rå", "stk");
    await addFood("kiwi rå", "Kiwi, rå", "stk");
    await addFood("stangselleri", "Stangselleri, norsk, rå", "stilk");

    expect(screen.getAllByRole("button", { name: /^Fjern / })).toHaveLength(4);
  });
});
