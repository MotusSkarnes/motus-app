import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PeriodPlanWeekNavigator } from "./PeriodPlanWeekNavigator";

describe("PeriodPlanWeekNavigator", () => {
  it("calls onWeekSelectByNumber when next arrow is clicked", async () => {
    const user = userEvent.setup();
    const onWeekSelectByNumber = vi.fn();

    render(
      <PeriodPlanWeekNavigator
        weeks={[
          { id: "w1", weekNumber: 1 },
          { id: "w2", weekNumber: 2 },
          { id: "w3", weekNumber: 3 },
        ]}
        selectedWeekNumber={1}
        onWeekSelectByNumber={onWeekSelectByNumber}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Neste uke" }));

    expect(onWeekSelectByNumber).toHaveBeenCalledWith(2);
    expect(screen.getByText("2 av 3")).toBeInTheDocument();
  });
});
