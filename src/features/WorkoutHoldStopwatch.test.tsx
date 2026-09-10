import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WorkoutHoldStopwatch } from "./WorkoutHoldStopwatch";

describe("WorkoutHoldStopwatch", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("shows start and stop in a pause-sized timer", () => {
    render(<WorkoutHoldStopwatch />);
    expect(screen.getByLabelText(/Stoppeklokke 0:00.00/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Start" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Stopp" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Stopp" })).toBeDisabled();
  });

  it("runs the clock and reports whole seconds on stop", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const onStopWithSeconds = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<WorkoutHoldStopwatch onStopWithSeconds={onStopWithSeconds} />);

    await user.click(screen.getByRole("button", { name: "Start" }));
    expect(screen.getByRole("button", { name: "Start" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Stopp" })).toBeEnabled();

    await vi.advanceTimersByTimeAsync(30_120);
    expect(screen.getByLabelText(/Stoppeklokke 0:30/)).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Stopp" }));
    expect(onStopWithSeconds).toHaveBeenCalledWith(30);
    expect(screen.getByRole("button", { name: "Start" })).toBeEnabled();
  });
});
