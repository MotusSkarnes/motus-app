import { describe, expect, it } from "vitest";
import {
  buildHomeWeekHeadline,
  buildHomeWeekInsight,
  buildHomeWeekMotivation,
  computeWeekProgressPct,
} from "./memberHomeWeekInsights";

describe("memberHomeWeekInsights", () => {
  it("computes progress from planned sessions", () => {
    expect(computeWeekProgressPct(6, 7)).toBe(86);
  });

  it("builds strong week headline when ahead of plan", () => {
    const headline = buildHomeWeekHeadline(6, 7, 86, "up");
    expect(headline.headline).toContain("Sterk uke");
  });

  it("suggests one session away from full week", () => {
    const now = new Date(2026, 4, 24);
    const weekDays = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(2026, 4, 18 + index);
      return {
        status: index < 6 ? "completed" : "planned",
        isToday: index === 6,
        date,
      };
    });
    const motivation = buildHomeWeekMotivation({
      completed: 6,
      planned: 7,
      progressPct: 86,
      momentumTrend: "flat",
      thisWeekSessions: 6,
      lastWeekSessions: 4,
      streakWeeks: 1,
      weekDays,
      nowDate: now,
    });
    expect(motivation?.title).toBe("Én økt unna full uke");
  });

  it("finds most consistent weekdays from recent logs", () => {
    const now = new Date(2026, 4, 24);
    const dates = [
      new Date(2026, 4, 4),
      new Date(2026, 4, 11),
      new Date(2026, 4, 18),
      new Date(2026, 4, 6),
      new Date(2026, 4, 13),
    ];
    const insight = buildHomeWeekInsight(dates, now);
    expect(insight.detail).toContain("mandager");
    expect(insight.detail).toContain("onsdager");
  });
});
