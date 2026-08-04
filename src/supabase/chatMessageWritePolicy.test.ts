import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(import.meta.dirname, "../..");

function readSql(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), "utf8");
}

function extractChatInsertPolicy(sql: string): string {
  const match = sql.match(
    /create policy "chat_messages_insert_own"[\s\S]*?with check \([\s\S]*?\);/,
  );
  expect(match?.[0]).toBeTruthy();
  return match![0];
}

/** Guard that chat insert requires roster ownership, not only message owner_user_id. */
function assertInsertPolicyRequiresMemberOwner(sql: string) {
  const policy = extractChatInsertPolicy(sql);
  expect(policy).toContain("chat_messages_insert_own");
  expect(policy).toMatch(/m\.owner_user_id\s*=\s*auth\.uid\(\)/);
  expect(policy).toMatch(/m\.id\s*=\s*chat_messages\.member_id/);
  // Reject the old single-clause owner-only check.
  expect(policy).not.toMatch(/with check \(\s*owner_user_id = auth\.uid\(\)\s*\);/);
}

describe("chat_messages write RLS", () => {
  it("strict RLS requires member roster ownership on insert", () => {
    assertInsertPolicyRequiresMemberOwner(readSql("src/supabase/rls_strict.sql"));
  });

  it("production bootstrap requires member roster ownership on insert", () => {
    assertInsertPolicyRequiresMemberOwner(readSql("src/supabase/production_bootstrap.sql"));
  });

  it("ownership patch requires member roster ownership on insert", () => {
    assertInsertPolicyRequiresMemberOwner(
      readSql("src/supabase/patch_chat_messages_rls_require_member_owner.sql"),
    );
  });
});
