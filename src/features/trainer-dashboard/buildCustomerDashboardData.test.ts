import { describe, expect, it } from "vitest";
import { buildCustomerTimeline } from "./buildCustomerDashboardData";
import type { WorkoutLog } from "../../app/types";

describe("buildCustomerTimeline", () => {
  it("includes logs with Norwegian dd.mm.yyyy dates", () => {
    const memberLogs: WorkoutLog[] = [
      {
        id: "l1",
        memberId: "m1",
        programTitle: "Styrke A",
        date: "20.05.2026",
        status: "Fullført",
        exercises: [],
      },
    ];
    const timeline = buildCustomerTimeline({ memberLogs, memberMessages: [] });
    expect(timeline).toHaveLength(1);
    expect(timeline[0]?.title).toContain("Styrke A");
    expect(timeline[0]?.timeLabel.length).toBeGreaterThan(0);
  });
});
