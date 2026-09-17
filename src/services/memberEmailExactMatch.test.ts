import { describe, expect, it } from "vitest";
import { filterRowsByExactEmail, memberIdsMatchingExactEmail, normalizeMemberEmail } from "./memberEmailExactMatch";

describe("filterRowsByExactEmail", () => {
  it("drops ilike wildcard false positives that differ by one character", () => {
    const rows = [
      { id: "exact", email: "jane_doe@example.com" },
      { id: "wildcard", email: "janexdoe@example.com" },
      { id: "other", email: "jane.doe@example.com" },
    ];
    expect(filterRowsByExactEmail(rows, "jane_doe@example.com").map((row) => row.id)).toEqual(["exact"]);
  });

  it("normalizes case and surrounding whitespace before comparing", () => {
    expect(
      filterRowsByExactEmail([{ id: "1", email: "Jane_Doe@Example.com" }], " jane_doe@example.com ").map(
        (row) => row.id,
      ),
    ).toEqual(["1"]);
  });

  it("returns empty when the lookup email is not a real address", () => {
    expect(filterRowsByExactEmail([{ id: "1", email: "a@b.com" }], "not-an-email")).toEqual([]);
  });
});

describe("memberIdsMatchingExactEmail", () => {
  it("returns only exact-match member ids", () => {
    expect(
      memberIdsMatchingExactEmail(
        [
          { id: "keep", email: "jane_doe@example.com" },
          { id: "drop", email: "janexdoe@example.com" },
          { id: "blank", email: "jane_doe@example.com" },
        ],
        "jane_doe@example.com",
      ),
    ).toEqual(["keep", "blank"]);
  });
});

describe("normalizeMemberEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeMemberEmail("  Foo@Bar.COM ")).toBe("foo@bar.com");
  });
});
