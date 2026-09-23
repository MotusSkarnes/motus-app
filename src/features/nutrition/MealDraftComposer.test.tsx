import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import type { MealDraftItem } from "../../app/mealDraft";
import type { MemberSavedMeal } from "../../app/memberSavedMeals";
import { MealDraftComposer } from "./MealDraftComposer";

const savedMeal: MemberSavedMeal = {
  id: "saved-1",
  name: "Fast frokost",
  mealSlotId: "member-frokost",
  items: [
    {
      name: "Havregryn",
      grams: 80,
      source: "food",
      nutritionPer100g: {
        kcal: 370,
        protein: 13,
        carbs: 60,
        fat: 7,
        fiber: 10,
        sugar: 1,
        saturatedFat: 1,
        sodium: 2,
      },
    },
  ],
  createdAt: "2026-09-01T08:00:00.000Z",
  updatedAt: "2026-09-01T08:00:00.000Z",
};

function Harness({ onSave }: { onSave: (meal: MemberSavedMeal) => void }) {
  const [draftItems, setDraftItems] = useState<MealDraftItem[]>([]);
  return (
    <MealDraftComposer
      mealSlotId="member-frokost"
      draftItems={draftItems}
      onDraftChange={setDraftItems}
      savedMeals={[savedMeal]}
      onSaveTemplate={onSave}
      onDeleteSaved={vi.fn()}
      onCommitLog={vi.fn()}
    />
  );
}

describe("MealDraftComposer saved meal editing", () => {
  it("edits the saved meal name and item amount", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<Harness onSave={onSave} />);

    await user.click(screen.getByPlaceholderText("Søk eller velg lagret måltid…"));
    await user.click(screen.getByRole("button", { name: "Rediger Fast frokost" }));

    const nameInput = screen.getByLabelText("Navn på måltidet");
    const amountInput = screen.getByLabelText("Mengde for Havregryn");
    expect(nameInput).toHaveValue("Fast frokost");
    expect(amountInput).toHaveValue(80);

    await user.clear(nameInput);
    await user.type(nameInput, "Stor frokost");
    await user.clear(amountInput);
    await user.type(amountInput, "120");
    await user.tab();
    await user.click(screen.getByRole("button", { name: "Lagre endringer" }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "saved-1",
        name: "Stor frokost",
        items: [expect.objectContaining({ name: "Havregryn", grams: 120 })],
      }),
    );
  });
});
