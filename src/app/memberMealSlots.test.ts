import { describe, expect, it } from "vitest";
import { canonicalMemberMealSlotId, memberMealSlotsMatch } from "./memberMealSlots";

describe("canonicalMemberMealSlotId", () => {
  it("keeps member slot ids", () => {
    expect(canonicalMemberMealSlotId("member-lunsj")).toBe("member-lunsj");
  });

  it("maps PT matplan meal ids from name hint", () => {
    expect(canonicalMemberMealSlotId("meal-2-lunsj", "Lunsj")).toBe("member-lunsj");
    expect(canonicalMemberMealSlotId("meal-0-frokost")).toBe("member-frokost");
  });
});

describe("memberMealSlotsMatch", () => {
  it("matches plan and member ids for same meal type", () => {
    expect(memberMealSlotsMatch("meal-0-lunsj", "Min lunsj", "member-lunsj")).toBe(true);
    expect(memberMealSlotsMatch("meal-0-lunsj", "Min lunsj", "member-frokost")).toBe(false);
  });
});
