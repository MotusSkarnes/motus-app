import { describe, expect, it } from "vitest";
import { formatNotificationTimestamp } from "./dateFormat";

describe("formatNotificationTimestamp", () => {
  it("formats same-day alerts as I dag kl HH:MM", () => {
    const now = new Date("2026-05-15T18:00:00");
    const received = new Date("2026-05-15T14:30:00").getTime();
    expect(formatNotificationTimestamp(received, now.getTime())).toBe("I dag kl 14:30");
  });

  it("formats older alerts with full date", () => {
    const now = new Date("2026-05-15T18:00:00").getTime();
    const received = new Date("2026-05-10T09:15:00").getTime();
    expect(formatNotificationTimestamp(received, now)).toBe("10.05.2026 kl 09:15");
  });
});
