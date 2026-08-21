import { describe, expect, it } from "vitest";
import {
  canTrainerWriteMemberRow,
  filterAuthorizedProgramMemberRows,
  isTrustedTrainerForProgramWrite,
  resolveSaveTrainingProgramRole,
} from "./saveTrainingProgramAuth";

const emptyCustomer = {
  email: "kunde@example.com",
  app_metadata: {},
  user_metadata: {},
};

const staffTrainer = {
  id: "trainer-1",
  email: "lene@motus-skarnes.no",
  app_metadata: { role: "trainer" },
  user_metadata: {},
};

describe("resolveSaveTrainingProgramRole", () => {
  it("treats invited customers with empty metadata as members, not trainers", () => {
    expect(resolveSaveTrainingProgramRole(emptyCustomer)).toBe("member");
  });

  it("does not let a customer become a trainer by forging user_metadata.role when app_metadata says member", () => {
    expect(
      resolveSaveTrainingProgramRole({
        email: "kunde@example.com",
        app_metadata: { role: "member", member_id: "mem-1" },
        user_metadata: { role: "trainer" },
      }),
    ).toBe("member");
  });

  it("treats linked member_id as member even without an explicit role", () => {
    expect(
      resolveSaveTrainingProgramRole({
        email: "kunde@example.com",
        app_metadata: { member_id: "mem-1" },
        user_metadata: {},
      }),
    ).toBe("member");
  });

  it("treats staff email with empty metadata as trainer", () => {
    expect(
      resolveSaveTrainingProgramRole({
        email: "lene@motus-skarnes.no",
        app_metadata: {},
        user_metadata: {},
      }),
    ).toBe("trainer");
  });

  it("keeps OTP-invited trainers with only user_metadata.role", () => {
    expect(
      resolveSaveTrainingProgramRole({
        email: "pt@gmail.com",
        app_metadata: {},
        user_metadata: { role: "trainer" },
      }),
    ).toBe("trainer");
  });
});

describe("isTrustedTrainerForProgramWrite", () => {
  it("rejects empty-metadata customers so they cannot overwrite org templates", () => {
    expect(isTrustedTrainerForProgramWrite(emptyCustomer)).toBe(false);
  });

  it("rejects forged user_metadata trainer role without app_metadata.role", () => {
    expect(
      isTrustedTrainerForProgramWrite({
        email: "kunde@example.com",
        app_metadata: {},
        user_metadata: { role: "trainer" },
      }),
    ).toBe(false);
  });

  it("allows app_metadata trainers and Motus staff emails", () => {
    expect(isTrustedTrainerForProgramWrite(staffTrainer)).toBe(true);
    expect(
      isTrustedTrainerForProgramWrite({
        email: "iben@motus-skarnes.no",
        app_metadata: {},
        user_metadata: {},
      }),
    ).toBe(true);
  });

  it("rejects staff accounts that are linked as customers", () => {
    expect(
      isTrustedTrainerForProgramWrite({
        email: "resepsjon@motus-skarnes.no",
        app_metadata: { role: "trainer", member_id: "auth-uuid-resepsjon" },
        user_metadata: {},
      }),
    ).toBe(false);
  });
});

describe("trainer member-row authorization", () => {
  const owned = {
    id: "mem-owned",
    email: "owned@example.com",
    owner_user_id: "trainer-1",
    customer_type: "PT-kunde",
    membership_type: "Premium",
  };
  const otherPt = {
    id: "mem-other",
    email: "other@example.com",
    owner_user_id: "trainer-2",
    customer_type: "PT-kunde",
    membership_type: "Premium",
  };
  const sharedMedlem = {
    id: "mem-shared",
    email: "medlem@example.com",
    owner_user_id: "trainer-2",
    customer_type: "Medlem",
    membership_type: "Standard",
  };

  it("lets a trainer write owned private customers but not another PT's private customer", () => {
    expect(canTrainerWriteMemberRow("trainer-1", owned, true)).toBe(true);
    expect(canTrainerWriteMemberRow("trainer-1", otherPt, true)).toBe(false);
  });

  it("lets trusted trainers write shared Medlem rows they do not own", () => {
    expect(canTrainerWriteMemberRow("trainer-1", sharedMedlem, true)).toBe(true);
    expect(canTrainerWriteMemberRow("trainer-1", sharedMedlem, false)).toBe(false);
  });

  it("blocks empty-metadata customers from writing another member's programs via trainer role", () => {
    const authorized = filterAuthorizedProgramMemberRows(emptyCustomer, "member", [owned, otherPt, sharedMedlem]);
    expect(authorized.map((row) => row.id)).toEqual([]);
  });

  it("keeps only the caller's own email rows for member sessions", () => {
    const authorized = filterAuthorizedProgramMemberRows(
      { email: "owned@example.com", app_metadata: { role: "member" }, user_metadata: {} },
      "member",
      [owned, otherPt],
    );
    expect(authorized.map((row) => row.id)).toEqual(["mem-owned"]);
  });

  it("keeps a trainer's owned private customer and drops another PT's private customer", () => {
    const authorized = filterAuthorizedProgramMemberRows(staffTrainer, "trainer", [owned, otherPt, sharedMedlem]);
    expect(authorized.map((row) => row.id)).toEqual(["mem-owned", "mem-shared"]);
  });

  it("does not treat jwtMemberId === auth-<uid> as matching arbitrary rows", () => {
    const authorized = filterAuthorizedProgramMemberRows(
      {
        id: "user-1",
        email: "attacker@example.com",
        app_metadata: { member_id: "auth-user-1" },
        user_metadata: {},
      },
      "member",
      [otherPt],
    );
    expect(authorized).toEqual([]);
  });
});
