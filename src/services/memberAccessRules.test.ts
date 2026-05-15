import { describe, expect, it } from "vitest";
import {
  filterMemberIdsForRosterSave,
  isPrivatePtRosterCustomerType,
  isSharedMedlemCustomerType,
  resolveOwnerUserIdForPersist,
  scoreMemberProfileSource,
} from "./memberAccessRules";

const TRAINER_A = "5a8aa65c-f6fb-47ee-9f76-617e52db83aa";
const TRAINER_B = "dc9e8855-6438-4173-8976-a86c75e16e5f";

describe("memberAccessRules", () => {
  it("treats Medlem as shared", () => {
    expect(isSharedMedlemCustomerType("Medlem")).toBe(true);
    expect(isPrivatePtRosterCustomerType("PT-kunde")).toBe(true);
  });

  it("assigns private roster owner to inviting PT", () => {
    expect(
      resolveOwnerUserIdForPersist({
        customerType: "PT-kunde",
        sessionOwnerId: TRAINER_A,
        existingOwnerId: TRAINER_B,
      }),
    ).toBe(TRAINER_A);
  });

  it("keeps existing owner for Medlem when set", () => {
    expect(
      resolveOwnerUserIdForPersist({
        customerType: "Medlem",
        sessionOwnerId: TRAINER_A,
        existingOwnerId: TRAINER_B,
      }),
    ).toBe(TRAINER_B);
  });

  it("fans out Medlem saves to all rows with same email", () => {
    const ids = filterMemberIdsForRosterSave({
      memberRows: [
        { id: "m1", email: "x@y.no", ownerUserId: TRAINER_A, customerType: "Medlem" },
        { id: "m2", email: "x@y.no", ownerUserId: TRAINER_B, customerType: "Medlem" },
      ],
      previousEmail: "x@y.no",
      nextCustomerType: "Medlem",
      currentTrainerOwnerUserId: TRAINER_A,
      selectedMemberId: "m1",
      selectedOwnerUserId: TRAINER_A,
    });
    expect(ids.sort()).toEqual(["m1", "m2"]);
  });

  it("prefers owned PT-kunde profile over shared Medlem stub", () => {
    const ptScore = scoreMemberProfileSource(
      { customerType: "PT-kunde", membershipType: "Premium", ownerUserId: TRAINER_A },
      TRAINER_A,
    );
    const medlemScore = scoreMemberProfileSource({ customerType: "Medlem", ownerUserId: TRAINER_B }, TRAINER_A);
    expect(ptScore).toBeGreaterThan(medlemScore);
  });

  it("limits PT-kunde saves to rows owned by current PT", () => {
    const ids = filterMemberIdsForRosterSave({
      memberRows: [
        { id: "m1", email: "x@y.no", ownerUserId: TRAINER_A, customerType: "Medlem" },
        { id: "m2", email: "x@y.no", ownerUserId: TRAINER_B, customerType: "PT-kunde" },
      ],
      previousEmail: "x@y.no",
      nextCustomerType: "PT-kunde",
      currentTrainerOwnerUserId: TRAINER_A,
      selectedMemberId: "m1",
      selectedOwnerUserId: TRAINER_A,
    });
    expect(ids).toEqual(["m1"]);
  });
});
