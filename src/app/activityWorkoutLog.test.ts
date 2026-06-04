import { describe, expect, it } from "vitest";
import { activityWorkoutLogTitle, formatActivityDurationLabel, isActivityWorkoutLog } from "./activityWorkoutLog";

describe("activityWorkoutLog", () => {
  it("builds aktivitet title", () => {
    expect(activityWorkoutLogTitle("Turgåing")).toBe("Aktivitet: Turgåing");
  });

  it("detects activity logs", () => {
    expect(isActivityWorkoutLog({ programTitle: "Aktivitet: Sykling" })).toBe(true);
    expect(isActivityWorkoutLog({ programTitle: "Gruppetime: Yoga" })).toBe(false);
  });

  it("formats duration labels", () => {
    expect(formatActivityDurationLabel("45")).toBe("45 min");
    expect(formatActivityDurationLabel("90")).toBe("1 t 30 min");
  });
});
