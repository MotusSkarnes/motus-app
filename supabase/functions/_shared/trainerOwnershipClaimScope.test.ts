import { describe, expect, it } from "vitest";
import {
  isSharedMedlemCustomerType,
  memberIdsEligibleForNullOwnerBackfill,
  memberIdsEligibleForRestoreClaimMigration,
} from "./trainerOwnershipClaimScope";

describe("isSharedMedlemCustomerType", () => {
  it("matches Medlem case-insensitively", () => {
    expect(isSharedMedlemCustomerType("Medlem")).toBe(true);
    expect(isSharedMedlemCustomerType(" medlem ")).toBe(true);
    expect(isSharedMedlemCustomerType("PT-kunde")).toBe(false);
    expect(isSharedMedlemCustomerType(null)).toBe(false);
  });
});

describe("memberIdsEligibleForNullOwnerBackfill", () => {
  it("keeps only members owned by the hydrating trainer", () => {
    const ids = memberIdsEligibleForNullOwnerBackfill(
      [
        { id: "owned", owner_user_id: "trainer-b" },
        { id: "shared-medlem", owner_user_id: "trainer-a" },
        { id: "orphan-member", owner_user_id: null },
        { id: "also-owned", owner_user_id: "trainer-b" },
      ],
      "trainer-b",
    );
    expect(ids).toEqual(["owned", "also-owned"]);
  });

  it("returns empty when trainer id is missing", () => {
    expect(
      memberIdsEligibleForNullOwnerBackfill([{ id: "owned", owner_user_id: "trainer-b" }], "  "),
    ).toEqual([]);
  });
});

describe("memberIdsEligibleForRestoreClaimMigration", () => {
  it("excludes shared Medlem rows when claimForTrainer migrates child ownership", () => {
    const ids = memberIdsEligibleForRestoreClaimMigration(
      [
        { id: "pt-kunde", customer_type: "PT-kunde" },
        { id: "shared", customer_type: "Medlem" },
        { id: "blank-type", customer_type: "" },
      ],
      { claimForTrainer: true, ownerUserId: "trainer-b" },
    );
    expect(ids).toEqual(["pt-kunde", "blank-type"]);
  });

  it("returns empty when claimForTrainer is false or owner missing", () => {
    const rows = [{ id: "pt-kunde", customer_type: "PT-kunde" }];
    expect(
      memberIdsEligibleForRestoreClaimMigration(rows, { claimForTrainer: false, ownerUserId: "trainer-b" }),
    ).toEqual([]);
    expect(
      memberIdsEligibleForRestoreClaimMigration(rows, { claimForTrainer: true, ownerUserId: "" }),
    ).toEqual([]);
  });
});
