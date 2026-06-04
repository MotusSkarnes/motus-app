import { describe, expect, it } from "vitest";
import {
  activityWorkoutLogTitle,
  filterActivityNameSuggestions,
  formatActivityDurationLabel,
  formatReflectionLevelForDisplay,
  groupWorkoutLogTitle,
  isActivityWorkoutLog,
  isGroupWorkoutLog,
  parseGroupClassNameFromLogTitle,
  reflectionLevelToStorage,
  reflectionLevelToUi,
  workoutReflectionEmoji,
} from "./activityWorkoutLog";

describe("activityWorkoutLog", () => {
  it("builds aktivitet title", () => {
    expect(activityWorkoutLogTitle("Turgåing")).toBe("Aktivitet: Turgåing");
  });

  it("detects activity logs", () => {
    expect(isActivityWorkoutLog({ programTitle: "Aktivitet: Sykling" })).toBe(true);
    expect(isActivityWorkoutLog({ programTitle: "Gruppetime: Yoga" })).toBe(false);
  });

  it("filters activity suggestions by first-letter prefix", () => {
    expect(filterActivityNameSuggestions("")).toContain("Frisbeegolf");
    expect(filterActivityNameSuggestions("S")).toEqual(
      expect.arrayContaining(["Sykling", "Svømming", "Ski", "Spinning", "Squash", "Stavtur", "Styrke annet sted"]),
    );
    expect(filterActivityNameSuggestions("S")).not.toContain("Turgåing");
    expect(filterActivityNameSuggestions("Fris")).toEqual(["Frisbeegolf"]);
  });

  it("maps ui reflection scale to stored scale and display", () => {
    expect(workoutReflectionEmoji(1)).toBe("🥵");
    expect(workoutReflectionEmoji(5)).toBe("🥳");
    expect(reflectionLevelToStorage(1)).toBe(5);
    expect(reflectionLevelToUi(5)).toBe(1);
    expect(formatReflectionLevelForDisplay(5)).toBe("1/5");
    expect(formatReflectionLevelForDisplay(1)).toBe("5/5");
  });

  it("formats duration labels", () => {
    expect(formatActivityDurationLabel("45")).toBe("45 min");
    expect(formatActivityDurationLabel("90")).toBe("1 t 30 min");
  });

  it("detects group workout logs", () => {
    expect(isGroupWorkoutLog({ programTitle: "Gruppetime: Yoga" })).toBe(true);
    expect(groupWorkoutLogTitle("Spinning")).toBe("Gruppetime: Spinning");
    expect(parseGroupClassNameFromLogTitle("Gruppetime: Pilates")).toBe("Pilates");
  });
});
