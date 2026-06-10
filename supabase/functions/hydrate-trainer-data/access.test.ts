import { describe, expect, it } from "vitest";
import { programRowVisibleToTrainer } from "./access.ts";

const ownerUserId = "trainer-a";

describe("hydrate-trainer-data program visibility", () => {
  it("allows programs owned by the requesting trainer", () => {
    expect(
      programRowVisibleToTrainer(
        { member_id: "private-member", owner_user_id: ownerUserId },
        ownerUserId,
        new Set(),
        new Set(),
      ),
    ).toBe(true);
  });

  it("allows cross-owner programs only for shared Medlem customers", () => {
    expect(
      programRowVisibleToTrainer(
        { member_id: "shared-member", owner_user_id: "trainer-b" },
        ownerUserId,
        new Set(["shared-member"]),
        new Set(),
      ),
    ).toBe(true);
  });

  it("rejects private cross-owner programs found through duplicate emails or stale links", () => {
    expect(
      programRowVisibleToTrainer(
        { member_id: "private-member", owner_user_id: "trainer-b" },
        ownerUserId,
        new Set(["shared-member"]),
        new Set(["owned-member"]),
      ),
    ).toBe(false);
  });

  it("allows ownerless legacy rows only for visible members owned by the trainer", () => {
    expect(
      programRowVisibleToTrainer(
        { member_id: "owned-member", owner_user_id: null },
        ownerUserId,
        new Set(),
        new Set(["owned-member"]),
      ),
    ).toBe(true);
    expect(
      programRowVisibleToTrainer(
        { member_id: "private-member", owner_user_id: null },
        ownerUserId,
        new Set(),
        new Set(["owned-member"]),
      ),
    ).toBe(false);
  });
});
