import { describe, expect, it } from "vitest";
import { estimate1RmKg } from "./personalRecordProgress";
import { motusShareStatusMessage } from "./motusShareCard";

describe("motusShareCard", () => {
  it("maps share outcomes to Norwegian status messages", () => {
    expect(motusShareStatusMessage("shared")).toContain("Facebook");
    expect(motusShareStatusMessage("downloaded")).toContain("Facebook");
    expect(motusShareStatusMessage("cancelled")).toContain("avbrutt");
  });

  it("uses Epley estimate for PR cards when omitted", () => {
    expect(estimate1RmKg(100, 5)).toBeGreaterThan(100);
  });
});
