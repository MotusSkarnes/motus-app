import { describe, expect, it } from "vitest";
import { filterMemberRowsByExactEmails } from "./memberEmailQueries";

describe("filterMemberRowsByExactEmails", () => {
  it("drops ilike wildcard siblings such as underscore vs dot in the local part", () => {
    const rows = [
      { id: "attacker", email: "kari_svendsen@gmail.com" },
      { id: "victim", email: "kari.svendsen@gmail.com" },
      { id: "other", email: "kariXsvendsen@gmail.com" },
    ];
    expect(filterMemberRowsByExactEmails(rows, ["kari_svendsen@gmail.com"]).map((row) => row.id)).toEqual([
      "attacker",
    ]);
  });

  it("keeps case-insensitive exact duplicates of the same address", () => {
    const rows = [
      { id: "lower", email: "ola.nordmann@motus.no" },
      { id: "upper", email: "Ola.Nordmann@Motus.no" },
      { id: "wildcard", email: "ola_nordmann@motus.no" },
    ];
    expect(filterMemberRowsByExactEmails(rows, ["Ola.Nordmann@motus.no"]).map((row) => row.id)).toEqual([
      "lower",
      "upper",
    ]);
  });

  it("returns no rows when the requested email set is empty", () => {
    expect(filterMemberRowsByExactEmails([{ id: "a", email: "a@example.com" }], [])).toEqual([]);
  });
});
