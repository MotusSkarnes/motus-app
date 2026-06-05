import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProgramCoverImageField } from "./ProgramCoverImageField";

describe("ProgramCoverImageField", () => {
  afterEach(() => {
    cleanup();
  });

  it("marks remove clicks as explicit cover removals", async () => {
    const onImageUrlChange = vi.fn();

    render(
      <ProgramCoverImageField
        imageUrl="https://cdn.example/program-cover.jpg"
        onImageUrlChange={onImageUrlChange}
        onUploadFile={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Fjern bilde" }));

    expect(onImageUrlChange).toHaveBeenCalledWith("", { removed: true });
  });
});
