import { describe, expect, it } from "vitest";
import { applyArchiveTombstonesToMembers, emailHasArchiveTombstone } from "./memberArchiveTombstone";
import type { Member } from "./types";

const member = (overrides: Partial<Member>): Member => ({
  id: "m1",
  name: "Kari",
  email: "kari@test.no",
  phone: "",
  birthDate: "",
  goal: "",
  injuries: "",
  focus: "",
  level: "Nybegynner",
  membershipType: "Standard",
  customerType: "PT-kunde",
  daysSinceActivity: "0",
  isActive: true,
  invitedAt: "",
  ...overrides,
});

describe("member archive tombstones", () => {
  it("matches tombstones case-insensitively by normalized email", () => {
    const tombstones = new Set(["kari@test.no"]);

    expect(emailHasArchiveTombstone(" Kari@Test.No ", tombstones)).toBe(true);
    expect(emailHasArchiveTombstone("ola@test.no", tombstones)).toBe(false);
  });

  it("forces hydrated active members inactive when their email is tombstoned", () => {
    const members = [
      member({ id: "active", email: "kari@test.no", isActive: true }),
      member({ id: "other", email: "ola@test.no", isActive: true }),
    ];

    const next = applyArchiveTombstonesToMembers(members, new Set(["kari@test.no"]));

    expect(next.find((entry) => entry.id === "active")?.isActive).toBe(false);
    expect(next.find((entry) => entry.id === "other")?.isActive).toBe(true);
  });
});
