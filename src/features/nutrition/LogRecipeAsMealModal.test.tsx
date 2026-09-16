import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MealDraftItem } from "../../app/mealDraft";
import { LogRecipeAsMealModal } from "./LogRecipeAsMealModal";

afterEach(() => cleanup());

const draft: MealDraftItem[] = [
  {
    id: "draft-recipe-ing-0",
    name: "Havregryn",
    grams: 40,
    source: "food",
    foodId: "havre",
    nutritionPer100g: {
      kcal: 370,
      protein: 13,
      carbs: 60,
      fat: 7,
      fiber: 8,
      sugar: 1,
      saturatedFat: 1,
      sodium: 0,
    },
  },
];

describe("LogRecipeAsMealModal", () => {
  it("preloads the recipe and lets the member pick a meal type before logging", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onLogged = vi.fn();
    render(
      <LogRecipeAsMealModal
        open
        memberId="member-test-recipe-log"
        recipeTitle="Havregrøt"
        initialDraftItems={draft}
        defaultMealSlotId="member-frokost"
        foodItems={[]}
        onClose={onClose}
        onLogged={onLogged}
      />,
    );

    expect(screen.getByRole("dialog", { name: "Logg som måltid" })).toBeInTheDocument();
    expect(screen.getByText("Havregryn · 40 g")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Frokost" })).toHaveAttribute("aria-selected", "true");

    await user.click(screen.getByRole("tab", { name: "Lunsj" }));
    expect(screen.getByRole("tab", { name: "Lunsj" })).toHaveAttribute("aria-selected", "true");

    await user.click(screen.getByRole("button", { name: "Logg måltid" }));
    expect(onLogged).toHaveBeenCalledWith(
      expect.objectContaining({ mealSlotId: "member-lunsj", itemCount: 1 }),
    );
    expect(onClose).toHaveBeenCalled();
  });
});
