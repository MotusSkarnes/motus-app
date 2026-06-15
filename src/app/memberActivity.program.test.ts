import { describe, expect, it } from "vitest";
import { logsAttributedToMember, programBelongsToMember, programsAttributedToMember } from "./memberActivity";
import type { Member, TrainingProgram, WorkoutLog } from "./types";

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

  it("counts both trainer-created and member-saved programs for the same customer", () => {
    const memberSavedFromInspo: TrainingProgram = {
      ...programOnCanonical,
      id: "prog-member-inspo",
      memberId: "uuid-canonical",
      title: "Inspo løp",
      programCreatedBy: "member",
      programCreatedByName: "Kari",
    };
    const trainerCreated: TrainingProgram = {
      ...programOnCanonical,
      id: "prog-trainer",
      memberId: "m-local",
      title: "PT styrke",
      programCreatedBy: "trainer",
      programCreatedByName: "Lene",
    };

    expect(programsAttributedToMember(ptMember, [ptMember, canonicalMember], [memberSavedFromInspo, trainerCreated])).toHaveLength(2);
  });

  it("matches member-saved program by member author name when stored on auth id", () => {
    const memberSavedOnAuthId: TrainingProgram = {
      ...programOnCanonical,
      id: "prog-auth-member",
      memberId: "auth-user-id-from-login",
      title: "Inspo styrke",
      programCreatedBy: "member",
      programCreatedByName: "Kari Nord",
    };

    expect(programBelongsToMember(ptMember, [ptMember], memberSavedOnAuthId)).toBe(true);
  });

  it("matches member-saved program when author name is a prefix of member name", () => {
    const memberSavedOnAuthId: TrainingProgram = {
      ...programOnCanonical,
      id: "prog-auth-member-prefix",
      memberId: "auth-user-id-from-login",
      title: "Inspo styrke",
      programCreatedBy: "member",
      programCreatedByName: "Kari",
    };

    expect(programBelongsToMember(ptMember, [ptMember], memberSavedOnAuthId)).toBe(true);
  });
});

describe("logsAttributedToMember", () => {
  it("matches legacy email member_id for PT customers", () => {
    const log: WorkoutLog = {
      id: "log-1",
      memberId: "kari@example.com",
      programTitle: "Styrke A",
      date: "22.05.2026 kl 18:30",
      status: "Fullført",
      results: [],
    };
    expect(logsAttributedToMember(ptMember, [ptMember, canonicalMember], [log])).toEqual([log]);
  });
});
