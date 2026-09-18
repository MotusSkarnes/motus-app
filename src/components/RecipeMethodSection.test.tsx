import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { RecipeMethodSection } from "./RecipeMethodSection";

afterEach(() => {
  cleanup();
});

describe("RecipeMethodSection", () => {
  it("viser hvert steg med synlig nummer", () => {
    render(
      <RecipeMethodSection
        body={"**Slik gjør du**\n1. Mos avokadoen.\n2. Ha på brød.\n3. Topp med chili."}
      />,
    );

    expect(screen.getByRole("heading", { name: "Slik gjør du" })).toBeInTheDocument();
    expect(screen.getByLabelText("Steg 1")).toHaveTextContent("1");
    expect(screen.getByLabelText("Steg 1")).toHaveTextContent("Mos avokadoen.");
    expect(screen.getByLabelText("Steg 2")).toHaveTextContent("Ha på brød.");
    expect(screen.getByLabelText("Steg 3")).toHaveTextContent("Topp med chili.");
  });

  it("splitter nummererte steg skrevet på én linje", () => {
    render(<RecipeMethodSection body={"**Slik gjør du**\n1. Varm pannen. 2. Stek egget."} />);

    expect(screen.getByLabelText("Steg 1")).toHaveTextContent("Varm pannen.");
    expect(screen.getByLabelText("Steg 2")).toHaveTextContent("Stek egget.");
  });
});
