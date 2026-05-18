import { afterEach, describe, expect, it } from "vitest";
import {
  collectCanonicalMemberIds,
  filterMembersForSessionEmail,
  isDemoSeedMemberId,
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

  it("reports session owner email change", () => {
    window.localStorage.setItem("motus.sessionOwnerEmail", "a@b.com");
    expect(sessionOwnerEmailChanged("leneruud@msn.com")).toBe(true);
    window.localStorage.removeItem("motus.sessionOwnerEmail");
  });
});
