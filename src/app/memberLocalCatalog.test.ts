import { afterEach, describe, expect, it } from "vitest";
import {
  collectCanonicalMemberIds,
  filterMembersForSessionEmail,
  filterProgramsForMemberSession,
  isContaminatedDemoMemberProfile,
  isDemoSeedMemberId,
  memberIdsForSessionEmail,
  sessionOwnerEmailChanged,
  stripDemoSeedCatalog,
} from "./memberLocalCatalog";
import type { AppState } from "./types";

const baseState = (): Pick<AppState, "members" | "programs" | "logs"> => ({
  members: [
    { id: "m1", name: "Emma", email: "emma@example.com", isActive: true } as AppState["members"][number],
    { id: "member-nmn08uu", name: "Lene", email: "leneruud@msn.com", isActive: true } as AppState["members"][number],
  ],
  programs: [
    { id: "p1", memberId: "m1", title: "Demo" } as AppState["programs"][number],
    { id: "p2", memberId: "member-nmn08uu", title: "Ekte" } as AppState["programs"][number],
  ],
  logs: [{ id: "l1", memberId: "m1", programTitle: "Demo", date: "01.01.2026", status: "Fullført", note: "", results: [] }],
});

describe("memberLocalCatalog", () => {
  afterEach(() => {
    window.localStorage.removeItem("motus.sessionOwnerEmail");
  });

  it("detects demo seed member ids", () => {
    expect(isDemoSeedMemberId("m1")).toBe(true);
    expect(isDemoSeedMemberId("member-nmn08uu")).toBe(false);
  });

  it("strips demo seed members, programs and logs", () => {
    const next = stripDemoSeedCatalog(baseState());
    expect(next.members.map((m) => m.id)).toEqual(["member-nmn08uu"]);
    expect(next.programs.map((p) => p.id)).toEqual(["p2"]);
    expect(next.logs).toEqual([]);
  });

  it("detects demo name on real member email as contaminated", () => {
    expect(
      isContaminatedDemoMemberProfile({
        id: "member-nmn08uu",
        name: "Emma Hansen",
        email: "leneruud@msn.com",
      } as AppState["members"][number]),
    ).toBe(true);
  });

  it("filters remote members to session email", () => {
    const filtered = filterMembersForSessionEmail(baseState().members, "leneruud@msn.com");
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.id).toBe("member-nmn08uu");
  });

  it("collects canonical member ids from catalogs", () => {
    const state = baseState();
    const ids = collectCanonicalMemberIds(state.members, state.programs, state.logs);
    expect(ids.has("member-nmn08uu")).toBe(true);
    expect(ids.has("m1")).toBe(true);
  });

  it("session email ids ignore other members programs", () => {
    const state = baseState();
    const resepsjonIds = memberIdsForSessionEmail(
      [
        { id: "resep-1", email: "resepsjon@motus-skarnes.no", name: "Resepsjon", isActive: true } as AppState["members"][number],
        { id: "lene-1", email: "ruudlene@gmail.com", name: "Lene", isActive: true } as AppState["members"][number],
      ],
      "resepsjon@motus-skarnes.no",
    );
    expect(resepsjonIds.has("resep-1")).toBe(true);
    expect(resepsjonIds.has("lene-1")).toBe(false);
    expect(resepsjonIds.has("m1")).toBe(false);
    const scopedPrograms = state.programs.filter((p) => resepsjonIds.has(p.memberId));
    expect(scopedPrograms).toHaveLength(0);
  });

  it("filterProgramsForMemberSession keeps programs on duplicate member ids with same email", () => {
    const members = [
      { id: "member-a", email: "lene@example.com", name: "Lene A", isActive: true } as AppState["members"][number],
      { id: "member-b", email: "lene@example.com", name: "Lene B", isActive: true } as AppState["members"][number],
    ];
    const programs = [
      { id: "p-a", memberId: "member-a", title: "Program A", exercises: [] } as AppState["programs"][number],
      { id: "p-b", memberId: "member-b", title: "Program B", exercises: [] } as AppState["programs"][number],
      { id: "p-other", memberId: "other-member", title: "Other", exercises: [] } as AppState["programs"][number],
    ];
    const scoped = filterProgramsForMemberSession(programs, members, "lene@example.com", { linkedMemberId: "member-a" });
    expect(scoped.map((program) => program.id).sort()).toEqual(["p-a", "p-b"]);
  });

  it("reports session owner email change", () => {
    window.localStorage.setItem("motus.sessionOwnerEmail", "a@b.com");
    expect(sessionOwnerEmailChanged("leneruud@msn.com")).toBe(true);
    window.localStorage.removeItem("motus.sessionOwnerEmail");
  });
});
