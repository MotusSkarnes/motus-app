import { describe, expect, it } from "vitest";
import type { ChatMessage, Member } from "./types";
import { mergeRemoteMessagesWithLocalOptimistic } from "./messageHydrationMerge";

function minimalMember(id: string, email: string): Member {
  return {
    id,
    name: "Test",
    email,
    isActive: true,
    invitedAt: "",
    phone: "",
    birthDate: "",
    weight: "",
    height: "",
    level: "Nybegynner",
    membershipType: "Standard",
    customerType: "Oppfølging",
    daysSinceActivity: "0",
    goal: "",
    focus: "",
    personalGoals: "",
    injuries: "",
    coachNotes: "",
  };
}

describe("mergeRemoteMessagesWithLocalOptimistic", () => {
  it("replaces local optimistic message with server row (no duplicate bubbles)", () => {
    const baseTime = new Date("2026-05-06T10:00:00.000Z").getTime();
    const nowMs = baseTime + 5000;

    const local: ChatMessage = {
      id: "msg-local-1",
      memberId: "m1",
      sender: "trainer",
      text: "Hei fra PT",
      createdAt: new Date(baseTime).toISOString(),
    };

    const server: ChatMessage = {
      id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      memberId: "m1",
      sender: "trainer",
      text: "Hei fra PT",
      createdAt: new Date(baseTime + 2000).toISOString(),
    };

    const members = [minimalMember("m1", "kunde@test.no")];

    const merged = mergeRemoteMessagesWithLocalOptimistic([server], [local], members, nowMs);

    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe(server.id);
    expect(merged[0].text).toBe("Hei fra PT");
  });

  it("keeps two short identical texts when they are far apart in time (no aggressive collapse)", () => {
    const members = [minimalMember("m1", "kunde@test.no")];
    const t1 = new Date("2026-05-06T10:00:00.000Z").getTime();
    const t2 = t1 + 5 * 60 * 1000;

    const remoteA: ChatMessage = {
      id: "r1",
      memberId: "m1",
      sender: "member",
      text: "ja",
      createdAt: new Date(t1).toISOString(),
    };
    const remoteB: ChatMessage = {
      id: "r2",
      memberId: "m1",
      sender: "member",
      text: "ja",
      createdAt: new Date(t2).toISOString(),
    };

    const merged = mergeRemoteMessagesWithLocalOptimistic([remoteA, remoteB], [], members, t2 + 1000);

    expect(merged.filter((m) => m.text === "ja")).toHaveLength(2);
    expect(merged.map((m) => m.id).sort()).toEqual(["r1", "r2"]);
  });
});
