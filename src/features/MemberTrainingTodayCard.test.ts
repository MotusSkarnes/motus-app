import { describe, expect, it } from "vitest";
import { extractZoneFromPlanEntry } from "./MemberTrainingTodayCard";

describe("extractZoneFromPlanEntry", () => {
  it("does not treat program titles with 'ro' substring as kondisjon", () => {
    expect(extractZoneFromPlanEntry("Styrkeprogram")).toBeNull();
    expect(extractZoneFromPlanEntry("Mitt program")).toBeNull();
    expect(extractZoneFromPlanEntry("Romanian deadlift")).toBeNull();
  });

  it("detects explicit conditioning keywords", () => {
    expect(extractZoneFromPlanEntry("Intervall 4x4")).toBe("Kondisjon");
    expect(extractZoneFromPlanEntry("Roing 2 km")).toBe("Kondisjon");
  });

  it("detects strength keywords before generic fallbacks", () => {
    expect(extractZoneFromPlanEntry("Styrke A")).toBe("Styrke");
  });
});
