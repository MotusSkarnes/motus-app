import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RecipePhoto } from "./RecipePhoto";

describe("RecipePhoto", () => {
  it("uses the shared 1:1 frame for recipe cards and meal-plan thumbs", () => {
    const { container, rerender } = render(<RecipePhoto src="https://example.com/r.jpg" size="card" alt="" />);
    expect(container.firstElementChild?.className).toContain("motus-recipe-photo--card");
    expect(container.querySelector("img")?.className).toContain("motus-recipe-photo__img");

    rerender(<RecipePhoto src="https://example.com/r.jpg" size="thumb" alt="" />);
    expect(container.firstElementChild?.className).toContain("motus-recipe-photo--thumb");
  });
});
