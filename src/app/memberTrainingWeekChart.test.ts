import { describe, expect, it } from "vitest";
import {
  computeDailyWeekProgress,
  computeWeeklyProgressDelta,
  computeWeeklyProgressPct,
} from "./memberTrainingWeekChart";

describe("memberTrainingWeekChart", () => {
  const now = new Date("2026-05-24T12:00:00").getTime();

  it("builds daily week points", () => {
    const dates = [new Date("2026-05-19"), new Date("2026-05-21")];
    const points = computeDailyWeekProgress(dates, now);
    expect(points).toHaveLength(7);
    expect(points.filter((point) => point.hasSession)).toHaveLength(2);
  });

  it("computes weekly progress pct", () => {
    const dates = [new Date("2026-05-19"), new Date("2026-05-21")];
    const points = computeDailyWeekProgress(dates, now);
    expect(computeWeeklyProgressPct(points, now)).toBeGreaterThan(0);
  });

  it("computes delta vs previous week", () => {
    const dates = [new Date("2026-05-19"), new Date("2026-05-12")];
    const delta = computeWeeklyProgressDelta(dates, now);
    expect(delta).not.toBeNull();
  });
});
