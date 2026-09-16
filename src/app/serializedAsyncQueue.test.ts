import { describe, expect, it } from "vitest";
import {
  applyShareBodyMetricsPreference,
  createMemberBodyMetricEntry,
  getBodyMetricsFromPersonalGoals,
  getShareBodyMetricsWithTrainer,
  mergeBodyMetricIntoPersonalGoals,
} from "./memberBodyMetrics";
import { createSerializedAsyncQueue } from "./serializedAsyncQueue";

const onboardingDone = `MOTUS_PROFILE_V1:${JSON.stringify({
  onboardingCompletedAt: "2026-01-01T00:00:00.000Z",
})}`;

describe("createSerializedAsyncQueue", () => {
  it("applies a later weight log onto the share-toggle blob instead of a stale snapshot", async () => {
    const queue = createSerializedAsyncQueue();
    let current = onboardingDone;
    const writes: string[] = [];

    async function persist(next: string) {
      await new Promise((resolve) => setTimeout(resolve, 20));
      current = next;
      writes.push(next);
    }

    const shareWrite = queue.enqueue(async () => {
      const next = applyShareBodyMetricsPreference(current, true, "2026-09-16T07:00:00.000Z");
      await persist(next);
    });
    const weightWrite = queue.enqueue(async () => {
      const entry = createMemberBodyMetricEntry({
        weightKg: 77.2,
        loggedAt: new Date("2026-09-16T07:00:01.000Z"),
      })!;
      const next = applyShareBodyMetricsPreference(
        mergeBodyMetricIntoPersonalGoals(current, entry),
        true,
        "2026-09-16T07:00:01.000Z",
      );
      await persist(next);
    });

    await Promise.all([shareWrite, weightWrite]);

    expect(writes).toHaveLength(2);
    expect(getShareBodyMetricsWithTrainer(writes[1])).toBe(true);
    expect(getBodyMetricsFromPersonalGoals(writes[1]).map((row) => row.weightKg)).toEqual([77.2]);
  });
});
