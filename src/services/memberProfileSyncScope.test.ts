import { describe, expect, it } from "vitest";
import { memberIdsSharingEmail } from "./memberProfileSyncScope";

describe("memberProfileSyncScope", () => {
  it("groups members only when they share the same email", () => {
    const rows = [
      { id: "new-emil", email: "emil.ringstad@icloud.com" },
      { id: "other-emil", email: "other@example.com", name: "Emil" },
    ];
    expect(memberIdsSharingEmail(rows, "emil.ringstad@icloud.com", { includeId: "new-emil" })).toEqual(["new-emil"]);
  });

  it("does not treat same display name as a shared profile", () => {
    const rows = [
      { id: "a", email: "a@example.com", name: "Emil" },
      { id: "b", email: "b@example.com", name: "Emil" },
    ];
    expect(memberIdsSharingEmail(rows, "a@example.com")).toEqual(["a"]);
    expect(memberIdsSharingEmail(rows, "b@example.com")).toEqual(["b"]);
  });
});
