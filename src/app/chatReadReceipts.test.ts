import { describe, expect, it } from "vitest";
import { applyChatReadReceiptsInState, isChatMessageReadByRecipient } from "./chatReadReceipts";
import type { ChatMessage } from "./types";

describe("chatReadReceipts", () => {
  it("marks trainer-read on member messages only", () => {
    const messages: ChatMessage[] = [
      { id: "1", memberId: "m1", sender: "member", text: "Hei", createdAt: "2026-01-01T10:00:00.000Z" },
      { id: "2", memberId: "m1", sender: "trainer", text: "Hei", createdAt: "2026-01-01T10:01:00.000Z" },
    ];
    const next = applyChatReadReceiptsInState(messages, "m1", "trainer", "2026-01-01T11:00:00.000Z");
    expect(next[0]?.readByTrainerAt).toBe("2026-01-01T11:00:00.000Z");
    expect(next[1]?.readByTrainerAt).toBeUndefined();
  });

  it("isChatMessageReadByRecipient respects sender", () => {
    const trainerMsg: ChatMessage = {
      id: "1",
      memberId: "m1",
      sender: "trainer",
      text: "x",
      createdAt: "",
      readByMemberAt: "2026-01-01T12:00:00.000Z",
    };
    expect(isChatMessageReadByRecipient(trainerMsg)).toBe(true);
    const memberMsg: ChatMessage = {
      id: "2",
      memberId: "m1",
      sender: "member",
      text: "x",
      createdAt: "",
      readByTrainerAt: "2026-01-01T12:00:00.000Z",
    };
    expect(isChatMessageReadByRecipient(memberMsg)).toBe(true);
  });
});
