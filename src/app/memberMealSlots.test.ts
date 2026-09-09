import { describe, expect, it } from "vitest";
import {
  canonicalMemberMealSlotId,
  memberMealSlotsMatch,
  persistMemberMealSlotAfterEdit,
  resolveMemberMealSlotSelectValue,
} from "./memberMealSlots";

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

describe("persistMemberMealSlotAfterEdit", () => {
  it("maps plan meal ids to member slots in the edit select", () => {
    expect(resolveMemberMealSlotSelectValue("meal-0-frokost")).toBe("member-frokost");
    expect(resolveMemberMealSlotSelectValue(undefined)).toBe("");
  });

  it("keeps the plan meal id when grams are saved without changing slot", () => {
    expect(persistMemberMealSlotAfterEdit("meal-0-frokost", "member-frokost")).toBe("meal-0-frokost");
    expect(persistMemberMealSlotAfterEdit("member-lunsj", "member-lunsj")).toBe("member-lunsj");
  });

  it("keeps Annet when the user does not pick a named slot", () => {
    expect(persistMemberMealSlotAfterEdit(undefined, "")).toBeUndefined();
    expect(persistMemberMealSlotAfterEdit("", "")).toBeUndefined();
  });

  it("writes the newly chosen member slot when the user moves the item", () => {
    expect(persistMemberMealSlotAfterEdit("meal-0-frokost", "member-lunsj")).toBe("member-lunsj");
    expect(persistMemberMealSlotAfterEdit(undefined, "member-middag")).toBe("member-middag");
  });
});
