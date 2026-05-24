import { describe, expect, it } from "vitest";
import { programBelongsToMember, programsAttributedToMember } from "./memberActivity";
import type { Member, TrainingProgram } from "./types";

const ptMember: Member = {
  id: "m-local",
  name: "Kari Nord",
  email: "kari@example.com",
  phone: "",
  birthDate: "",
  goal: "",
  injuries: "",
  focus: "",
  level: "",
  membershipType: "Standard",
  customerType: "PT-kunde",
  daysSinceActivity: "0",
};

const canonicalMember: Member = {
  ...ptMember,
  id: "uuid-canonical",
};

const programOnCanonical: TrainingProgram = {
  id: "prog-1",
  memberId: "uuid-canonical",
  title: "Styrke A",
  goal: "",
  notes: "",
  createdAt: "01.01.2026",
  exercises: [],
};

describe("programBelongsToMember", () => {
  it("matches program saved on canonical member id when PT selected local id", () => {
    expect(programBelongsToMember(ptMember, [ptMember, canonicalMember], programOnCanonical)).toBe(true);
    expect(programsAttributedToMember(ptMember, [ptMember, canonicalMember], [programOnCanonical])).toHaveLength(1);
  });

  it("does not match unrelated members", () => {
    const other: Member = { ...ptMember, id: "m-other", name: "Ola Nord", email: "other@example.com" };
    expect(programBelongsToMember(ptMember, [ptMember, canonicalMember, other], programOnCanonical)).toBe(true);
    expect(programBelongsToMember(other, [ptMember, canonicalMember, other], programOnCanonical)).toBe(false);
  });
});
