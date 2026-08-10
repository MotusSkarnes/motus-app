import { describe, expect, it } from "vitest";
import { filterRowsByExactEmail, memberIdsMatchingExactEmail } from "./memberEmailExactMatch";

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

describe("memberIdsMatchingExactEmail", () => {
  it("returns only exact-email ids from an ilike-shaped result set", () => {
    expect(
      memberIdsMatchingExactEmail(
        [
          { id: "keep", email: "ola_nordmann@motus.no" },
          { id: "drop", email: "olaxnordmann@motus.no" },
          { id: "blank", email: "ola_nordmann@motus.no" },
        ],
        "ola_nordmann@motus.no",
      ),
    ).toEqual(["keep", "blank"]);
  });
});
