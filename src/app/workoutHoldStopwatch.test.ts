import { describe, expect, it } from "vitest";
import { formatHoldStopwatch, holdStopwatchLoggedSeconds } from "./workoutHoldStopwatch";

describe("workoutHoldStopwatch", () => {
  it("formats minutes, seconds and hundredths", () => {
    expect(formatHoldStopwatch(0)).toBe("0:00.00");
    expect(formatHoldStopwatch(30)).toBe("0:00.03");
    expect(formatHoldStopwatch(1_040)).toBe("0:01.04");
    expect(formatHoldStopwatch(30_120)).toBe("0:30.12");
    expect(formatHoldStopwatch(75_000)).toBe("1:15.00");
  });

  it("rounds elapsed time to whole seconds for logging", () => {
    expect(holdStopwatchLoggedSeconds(0)).toBe(0);
    expect(holdStopwatchLoggedSeconds(499)).toBe(0);
    expect(holdStopwatchLoggedSeconds(500)).toBe(1);
    expect(holdStopwatchLoggedSeconds(30_120)).toBe(30);
    expect(holdStopwatchLoggedSeconds(30_500)).toBe(31);
  });
});
