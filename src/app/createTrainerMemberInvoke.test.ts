import { describe, expect, it } from "vitest";

function normalizeInvokeJsonPayload(raw: unknown): Record<string, unknown> | null {
  if (!raw) return null;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }
  if (typeof raw === "object") return raw as Record<string, unknown>;
  return null;
}

function parseCreateTrainerMemberInvokePayload(raw: unknown): Record<string, unknown> | null {
  const record = normalizeInvokeJsonPayload(raw);
  if (!record) return null;
  if (record.ok === true && record.member) return record;
  if (record.member && typeof record.member === "object") {
    return { ok: true, member: record.member };
  }
  const id = String(record.id ?? "").trim();
  const email = String(record.email ?? "").trim();
  const name = String(record.name ?? "").trim();
  if (id && email && name) {
    return { ok: true, member: record };
  }
  return null;
}

describe("parseCreateTrainerMemberInvokePayload", () => {
  it("accepts wrapped edge response", () => {
    const parsed = parseCreateTrainerMemberInvokePayload({
      ok: true,
      member: { id: "m1", name: "Kari", email: "kari@example.com" },
    });
    expect(parsed?.ok).toBe(true);
    expect((parsed?.member as { id: string }).id).toBe("m1");
  });

  it("accepts member object returned directly as invoke data", () => {
    const parsed = parseCreateTrainerMemberInvokePayload({
      id: "m2",
      name: "Ola",
      email: "ola@example.com",
    });
    expect(parsed?.ok).toBe(true);
    expect((parsed?.member as { email: string }).email).toBe("ola@example.com");
  });

  it("accepts JSON string payloads", () => {
    const parsed = parseCreateTrainerMemberInvokePayload(
      JSON.stringify({ ok: true, member: { id: "m3", name: "Per", email: "per@example.com" } }),
    );
    expect(parsed?.ok).toBe(true);
  });
});
