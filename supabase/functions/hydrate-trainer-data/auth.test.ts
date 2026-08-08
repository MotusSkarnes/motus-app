import { describe, expect, it } from "vitest";
import { assertTrainerHydrateAuth, extractBearerToken } from "./auth.ts";

function authClientFor(userId: string | null, errorMessage = "") {
  return {
    auth: {
      async getUser(token: string) {
        if (errorMessage) {
          return { data: null, error: { message: errorMessage } };
        }
        return {
          data: { user: userId ? { id: userId } : null },
          error: null,
          token,
        };
      },
    },
  };
}

describe("hydrate-trainer-data auth", () => {
  it("extracts bearer tokens case-insensitively", () => {
    expect(extractBearerToken("Bearer abc.def")).toBe("abc.def");
    expect(extractBearerToken("bearer token")).toBe("token");
    expect(extractBearerToken("Basic token")).toBe("");
    expect(extractBearerToken(null)).toBe("");
  });

  it("rejects requests without a bearer token", async () => {
    await expect(assertTrainerHydrateAuth(authClientFor("trainer-a"), "", "trainer-a")).resolves.toEqual({
      ok: false,
      status: 401,
      error: "Missing bearer token",
    });
  });

  it("rejects invalid session tokens", async () => {
    await expect(
      assertTrainerHydrateAuth(authClientFor(null, "invalid jwt"), "Bearer bad-token", "trainer-a"),
    ).resolves.toEqual({
      ok: false,
      status: 401,
      error: "Invalid session token",
    });
  });

  it("rejects valid trainers hydrating a different owner user id", async () => {
    await expect(
      assertTrainerHydrateAuth(authClientFor("trainer-a"), "Bearer trainer-a-token", "trainer-b"),
    ).resolves.toEqual({
      ok: false,
      status: 403,
      error: "Authenticated user cannot hydrate another trainer",
    });
  });

  it("allows the authenticated trainer to hydrate their own data", async () => {
    await expect(
      assertTrainerHydrateAuth(authClientFor("trainer-a"), "Bearer trainer-a-token", "trainer-a"),
    ).resolves.toEqual({
      ok: true,
      requesterUserId: "trainer-a",
    });
  });
});
