import { describe, expect, it } from "vitest";
import { memberNavTabs } from "./MemberTabNavigation";

describe("memberNavTabs", () => {
  it("includes nutrition and progress for limited members without messages in bottom nav", () => {
    const tabs = memberNavTabs(true);
    expect(tabs.map((tab) => tab.id)).toEqual([
      "overview",
      "programs",
      "nutrition",
      "inspiration",
      "progress",
    ]);
  });

  it("includes nutrition and progress for full members without messages in bottom nav", () => {
    const tabs = memberNavTabs(false);
    expect(tabs.map((tab) => tab.id)).toEqual([
      "overview",
      "programs",
      "nutrition",
      "inspiration",
      "progress",
    ]);
  });
});
