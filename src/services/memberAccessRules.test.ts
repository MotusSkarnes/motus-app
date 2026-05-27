import { describe, expect, it } from "vitest";
import {
  filterMemberIdsForRosterSave,
  isMemberAppAccessBlocked,
  isPrivatePtRosterCustomerType,
  isSharedMedlemCustomerType,
  isSharedMedlemRosterMember,
  memberRecordIsActive,
  isMemberIdentityVisibleToTrainer,
  mergeRosterFieldsFromMemberCandidates,
  resolveOwnerUserIdForPersist,
  scoreMemberProfileSource,
} from "./memberAccessRules";

const TRAINER_A = "5a8aa65c-f6fb-47ee-9f76-617e52db83aa";
const TRAINER_B = "dc9e8855-6438-4173-8976-a86c75e16e5f";

describe("memberAccessRules", () => {
  it("treats Medlem as shared", () => {
    expect(isSharedMedlemCustomerType("Medlem")).toBe(true);
    expect(isSharedMedlemRosterMember({ customerType: "Medlem", membershipType: "Standard" })).toBe(true);
    expect(isPrivatePtRosterCustomerType("PT-kunde")).toBe(true);
  });

  it("treats Premium Medlem rows as private", () => {
    expect(isSharedMedlemRosterMember({ customerType: "Medlem", membershipType: "Premium" })).toBe(false);
    expect(isPrivatePtRosterCustomerType("Medlem", "Premium")).toBe(true);
  });

  it("does not treat PT-kunde as shared Medlem (substring trap)", () => {
    expect(isSharedMedlemCustomerType("PT-kunde")).toBe(false);
    expect(isSharedMedlemCustomerType("pt-kunde")).toBe(false);
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

  it("blocks app access when all rows for email are inactive", () => {
    expect(memberRecordIsActive({ isActive: false })).toBe(false);
    expect(
      isMemberAppAccessBlocked(
        [
          { email: "x@y.no", isActive: false },
          { email: "x@y.no", isActive: false },
        ],
        "x@y.no",
      ),
    ).toBe(true);
    expect(isMemberAppAccessBlocked([{ email: "x@y.no", isActive: true }], "x@y.no")).toBe(false);
    expect(isMemberAppAccessBlocked([], "x@y.no")).toBe(false);
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
    expect(ids.sort()).toEqual(["m1"]);
  });

  it("includes all shared Medlem duplicates when upgrading to PT-kunde", () => {
    const ids = filterMemberIdsForRosterSave({
      memberRows: [
        { id: "m1", email: "karen@example.com", ownerUserId: TRAINER_B, customerType: "Medlem" },
        { id: "m2", email: "karen@example.com", ownerUserId: TRAINER_A, customerType: "Medlem" },
      ],
      previousEmail: "karen@example.com",
      nextCustomerType: "PT-kunde",
      currentTrainerOwnerUserId: TRAINER_A,
      selectedMemberId: "m1",
      selectedOwnerUserId: TRAINER_B,
    });
    expect(ids.sort()).toEqual(["m1", "m2"]);
  });

  it("prefers PT-kunde over Medlem when merging roster fields for duplicates", () => {
    const merged = mergeRosterFieldsFromMemberCandidates(
      [
        { customerType: "Medlem", membershipType: "Standard", ownerUserId: TRAINER_B },
        { customerType: "PT-kunde", membershipType: "Standard", ownerUserId: TRAINER_A },
      ],
      TRAINER_A,
    );
    expect(merged.customerType).toBe("PT-kunde");
    expect(merged.ownerUserId).toBe(TRAINER_A);
  });

  it("uses trainer-owned PT row for visibility when deduped owner is stale", () => {
    const allMembers = [
      {
        id: "karen-a",
        email: "karen@setergard.no",
        customerType: "PT-kunde" as const,
        membershipType: "Standard" as const,
        ownerUserId: TRAINER_A,
        isActive: true,
      },
      {
        id: "karen-b",
        email: "karen@setergard.no",
        customerType: "Medlem" as const,
        membershipType: "Standard" as const,
        ownerUserId: TRAINER_B,
        isActive: true,
      },
    ];
    const dedupedStub = {
      id: "karen-b",
      email: "karen@setergard.no",
      customerType: "PT-kunde" as const,
      membershipType: "Standard" as const,
      ownerUserId: TRAINER_B,
      isActive: true,
    };
    expect(isMemberIdentityVisibleToTrainer(dedupedStub, allMembers, TRAINER_A)).toBe(true);
  });

  it("shows private PT linked by programs for this trainer", () => {
    const member = {
      id: "karen-1",
      email: "karen@setergard.no",
      customerType: "PT-kunde" as const,
      membershipType: "Standard" as const,
      ownerUserId: "",
      isActive: true,
    };
    expect(
      isMemberIdentityVisibleToTrainer(member, [member], TRAINER_A, {
        programMemberIds: new Set(["karen-1"]),
      }),
    ).toBe(true);
  });
});
