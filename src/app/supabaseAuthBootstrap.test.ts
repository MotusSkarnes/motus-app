import { describe, expect, it } from "vitest";
import { hasAuthBootstrapSecrets, readAuthParamsFromLocation } from "./supabaseAuthBootstrap";

describe("readAuthParamsFromLocation", () => {
  it("detects invite flow with hash tokens", () => {
    const params = readAuthParamsFromLocation(
      "https://app.example/?type=invite&invite=1#access_token=at&refresh_token=rt&type=invite",
    );
    expect(params?.recoveryInviteFlow).toBe(true);
    expect(params?.accessToken).toBe("at");
    expect(params?.refreshToken).toBe("rt");
  });

  it("detects PKCE code with invite query flags", () => {
    const params = readAuthParamsFromLocation("https://app.example/?type=invite&invite=1&code=abc123");
    expect(params?.recoveryInviteFlow).toBe(true);
    expect(params?.authCode).toBe("abc123");
  });

  it("detects PKCE code in hash with invite query flags", () => {
    const params = readAuthParamsFromLocation("https://app.example/?type=invite&invite=1#code=abc123");
    expect(params?.recoveryInviteFlow).toBe(true);
    expect(params?.authCode).toBe("abc123");
  });

  it("returns null for normal app open", () => {
    expect(readAuthParamsFromLocation("https://app.example/")).toBeNull();
  });
});

describe("hasAuthBootstrapSecrets", () => {
  it("requires tokens or code", () => {
    expect(
      hasAuthBootstrapSecrets({
        recoveryInviteFlow: true,
        tokenHash: null,
        accessToken: null,
        refreshToken: null,
        authCode: null,
      }),
    ).toBe(false);
    expect(
      hasAuthBootstrapSecrets({
        recoveryInviteFlow: true,
        tokenHash: "hash",
        accessToken: null,
        refreshToken: null,
        authCode: null,
      }),
    ).toBe(true);
  });
});
