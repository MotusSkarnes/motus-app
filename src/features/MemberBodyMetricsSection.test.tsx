import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemberBodyMetricsSection } from "./MemberBodyMetricsSection";

describe("MemberBodyMetricsSection", () => {
  afterEach(() => cleanup());

  it("saves sharing as soon as the switch is toggled, without logging a measurement", async () => {
    const user = userEvent.setup();
    const onLog = vi.fn();
    const onShareChange = vi.fn();
    render(
      <MemberBodyMetricsSection
        personalGoals=""
        onLog={onLog}
        onShareChange={onShareChange}
        stopGoals={[]}
        setStopGoals={() => undefined}
        onSaveStopGoals={() => undefined}
      />,
    );

    await user.click(screen.getByRole("switch", { name: /Del med trener/i }));

    expect(onShareChange).toHaveBeenCalledTimes(1);
    expect(onShareChange).toHaveBeenCalledWith(true);
    expect(onLog).not.toHaveBeenCalled();
    expect(screen.getByRole("switch", { name: /Del med trener/i })).toHaveAttribute("aria-checked", "true");
  });
});
