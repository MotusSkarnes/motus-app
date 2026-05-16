import { describe, expect, it } from "vitest";
import { buildInspirationNotificationAlertCopy, parseInspirationNotificationTimestamp } from "./inspirationNotifications";
import type { InspirationNotificationItem } from "./inspirationStorage";

function item(partial: Partial<InspirationNotificationItem> & Pick<InspirationNotificationItem, "id" | "title">): InspirationNotificationItem {
  return {
    description: "",
    createdAt: "2026-05-01",
    category: "",
    kind: "article",
    ...partial,
  };
}

describe("inspirationNotifications", () => {
  it("uses program-specific alert title", () => {
    const copy = buildInspirationNotificationAlertCopy(
      item({ id: "inspiration-1", title: "Styrke A", kind: "program", category: "programs" }),
    );
    expect(copy.title).toBe("Nytt treningsprogram i inspirasjon");
    expect(copy.detail).toBe("Styrke A");
  });

  it("parses publish time from inspiration id", () => {
    const ms = 1_715_000_000_000;
    expect(parseInspirationNotificationTimestamp(item({ id: `inspiration-${ms}`, title: "Test" }))).toBe(ms);
  });
});
