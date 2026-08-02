import { describe, expect, it } from "vitest";
import { filterRowsByExactEmail } from "./memberEmailExactMatch";

describe("filterRowsByExactEmail", () => {
  it("drops ilike wildcard false positives that differ by one character", () => {
    const rows = [
      { id: "exact", email: "jane_doe@example.com" },
      { id: "wildcard", email: "janexdoe@example.com" },
    ];
    expect(filterRowsByExactEmail(rows, "jane_doe@example.com").map((row) => row.id)).toEqual(["exact"]);
  });

  it("matches emails case-insensitively after trim", () => {
    expect(
      filterRowsByExactEmail([{ id: "1", email: "Jane_Doe@Example.com" }], " jane_doe@example.com ").map(
        (row) => row.id,
      ),
    ).toEqual(["1"]);
  });

  it("returns empty for invalid target emails", () => {
    expect(filterRowsByExactEmail([{ id: "1", email: "a@b.com" }], "not-an-email")).toEqual([]);
  });
});
