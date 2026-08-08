import { describe, expect, it } from "vitest";
import {
  isTrustedTrainerUser,
  readTrustedAuthMemberId,
} from "./reassignMemberOwnerSecurity";

describe("reassignMemberOwnerSecurity", () => {
  it("ignores mutable user_metadata when reading trusted auth member id", () => {
    expect(
      readTrustedAuthMemberId({
        app_metadata: {},
        user_metadata: { member_id: "forged-member" },
      }),
    ).toBe("");
    expect(
      readTrustedAuthMemberId({
        app_metadata: { member_id: "real-member" },
        user_metadata: { member_id: "forged-member" },
      }),
    ).toBe("real-member");
  });

  it("rejects forged user_metadata.role for caller and transfer-target checks", () => {
    expect(
      isTrustedTrainerUser({
        id: "member-user",
        email: "member@example.com",
        app_metadata: {},
        user_metadata: { role: "trainer" },
      }),
    ).toBe(false);

    expect(
      isTrustedTrainerUser({
        id: "member-user",
        email: "member@example.com",
        app_metadata: { role: "member" },
        user_metadata: { role: "trainer" },
      }),
    ).toBe(false);
  });

  it("allows trainers via app_metadata.role or staff email without linked customer id", () => {
    expect(
      isTrustedTrainerUser({
        id: "trainer-1",
        email: "pt@example.com",
        app_metadata: { role: "trainer" },
        user_metadata: {},
      }),
    ).toBe(true);

    expect(
      isTrustedTrainerUser({
        id: "trainer-2",
        email: "lene@motus-skarnes.no",
        app_metadata: {},
        user_metadata: {},
      }),
    ).toBe(true);

    expect(
      isTrustedTrainerUser({
        id: "staff-as-client",
        email: "resepsjon@motus-skarnes.no",
        app_metadata: { member_id: "client-row" },
        user_metadata: { role: "trainer" },
      }),
    ).toBe(false);
  });
});
