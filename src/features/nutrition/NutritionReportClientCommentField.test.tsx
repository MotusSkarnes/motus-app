import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { NutritionReportClientCommentField } from "./NutritionReportClientCommentField";

function CommentHarness() {
  const [value, setValue] = useState("");
  return <NutritionReportClientCommentField value={value} onChange={setValue} />;
}

describe("NutritionReportClientCommentField", () => {
  it("lets the trainer type a comment", async () => {
    const user = userEvent.setup();
    render(<CommentHarness />);
    const field = screen.getByLabelText("Kommentar til kunderapporten");
    await user.click(field);
    await user.type(field, "Hold igjen på kveldsmaten.");
    expect(field).toHaveValue("Hold igjen på kveldsmaten.");
    expect(field).not.toHaveAttribute("readonly");
  });
});
